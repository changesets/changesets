import { resolve } from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import type { Packages } from "@changesets/types";
import { log } from "@clack/prompts";
import type { AuthState } from "../../utils/types.ts";
import type { PublishReleaseEntry } from "../publish-plan/getPublishPlan.ts";
import {
  npmPublishQueue,
  publish,
  type PublishTool,
  getPublishTool,
  sanitizeEnv,
  NPM_PUBLISH_CONCURRENCY_LIMIT,
} from "./npm-utils.ts";

export type PublishedResult = {
  name: string;
  version: string;
  result: "published" | "skipped" | "failed";
};

function getInitialAuthState(
  publishTool: PublishTool,
  otp?: string,
): AuthState {
  if (otp) {
    return {
      otpToken: otp,
      requiresInteractive: false,
    };
  }
  if (
    publishTool.name === "pnpm" &&
    (process.env.PNPM_CONFIG_OTP || process.env.pnpm_config_otp)
  ) {
    return {
      otpToken: process.env.PNPM_CONFIG_OTP || process.env.pnpm_config_otp,
      requiresInteractive: false,
    };
  }
  if (process.env.NPM_CONFIG_OTP || process.env.npm_config_otp) {
    return {
      otpToken: process.env.NPM_CONFIG_OTP || process.env.npm_config_otp,
      requiresInteractive: false,
    };
  }
  return {
    otpToken: undefined,
    requiresInteractive: false,
  };
}

export async function publishPackages({
  releases,
  packages,
  artifactDir,
  otp,
}: {
  releases: Array<PublishReleaseEntry>;
  packages: Packages;
  artifactDir?: string;
  otp?: string;
}): Promise<PublishedResult[]> {
  if (releases.length === 0) {
    return [];
  }
  const publishTool = await getPublishTool(packages);
  if (
    artifactDir &&
    publishTool.name === "yarn" &&
    publishTool.version === "berry"
  ) {
    log.error(`Publishing packed packages is not supported with Yarn Berry.`);
    throw new ExitError(1);
  }
  const authState = getInitialAuthState(publishTool, otp);
  const env = sanitizeEnv({
    ...process.env,
    // we take over initial OTP handling in our AuthState
    // so we unset those env variables so they don't become stale once we start delegating to the package manager CLIs for OTP prompting
    ...(publishTool.name === "pnpm"
      ? {
          PNPM_CONFIG_OTP: undefined,
          pnpm_config_otp: undefined,
          // pnpm 10 supported those so we clear them here too
          NPM_CONFIG_OTP: undefined,
          npm_config_otp: undefined,
        }
      : {
          NPM_CONFIG_OTP: undefined,
          npm_config_otp: undefined,
        }),
  });
  // in TTY mode let's allow the first publish to "check" if the publish process requires interactive auth or not
  // on CI everything has to be configured in a way that allows automation so we can safely allow concurrency up to the defined limit
  // but in TTY the user might rely on Changesets prompting (through the used package manager CLI) for OTP/web auth
  // this is just an appromixation of the best behavior that assumes a single publish target/registry with a consistent/shared auth setup
  npmPublishQueue.setConcurrency(
    process.stdin.isTTY && !authState.otpToken
      ? 1
      : NPM_PUBLISH_CONCURRENCY_LIMIT,
  );

  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );
  const publishPromises = releases.map(async (release) => {
    const pkg = packagesByName.get(release.name)!;
    let target: string | undefined;
    if (artifactDir) {
      target = resolve(artifactDir, release.tarball!.path);
    } else if (
      publishTool.name !== "pnpm" &&
      pkg.packageJson.publishConfig?.directory
    ) {
      // pnpm supports `publishConfig.directory` natively. We have to let it resolve it on its own.
      // Otherwise we'd risk it re-resolving from within the `publishConfig.directory` itself
      // but original untouched relative paths in `publishConfig.directory` would not even point to correct locations anymore.
      // npm, yarn classic and berry don't support `publishConfig.directory` natively.
      // We inherited support for it from Lerna, so we have to resolve it ourselves.
      // It's worth noting it's still useful for, for example, `ng-packagr` users
      // as that tool puts a whole publishable package in a dist directory (with full `package.json` in it).
      // Even though that tool doesn't support `publishConfig.directory` itself (it doesn't concern itself with publishing),
      // it's a useful knob for its users to specify how a packing/publishing should handle their output.
      //
      // WARNING: When relying on this, it's important to prebuild the `publishConfig.directory` before running the publish command.
      // It's not possible to rely on regular lifecycle publish scripts for that. We merely delegate to the package manager for publishing
      // and we don't reimplement the pack+publish logic ourselves. So it's not possible for us to pack,
      // and let appropriate lifecycle scripts run, from the package's original directory and then publish from a different `publishConfig.directory`.
      const publishDirOverride = pkg.packageJson.publishConfig?.directory;
      if (
        publishDirOverride &&
        publishTool.name === "yarn" &&
        publishTool.version === "berry"
      ) {
        // Yarn Berry doesn't allow publishing non-workspace directories
        log.error(
          `Package ${c.blue(pkg.packageJson.name)} has publishConfig.directory set to ${c.blue(publishDirOverride)}, which is not supported when using Yarn Berry. Please remove publishConfig.directory from your package.json.`,
        );
        throw new ExitError(1);
      }
      target = resolve(pkg.dir, publishDirOverride!);
    }
    const publishConfirmation = await publish(
      publishTool,
      release,
      {
        target,
        // cwd is super important for correct resolution of .npmrc
        //
        // In the past, we wouldn't be able to call npm in the package directory itself, because despite npm's workspace support introduced in npm 7.
        // It wouldn't actually be particularly workspaces-aware until npm 9 (until https://github.com/npm/cli/pull/4372).
        // So we'd have to call npm from the root with a nested package target because .npmrc would resolve in respect to cwd and not the target package and that's what we wanted.
        // Nowadays, this isn't important as .npmrc lookup is workspace-aware and finds the root .npmrc just fine even if invoked from the package directory.
        //
        // So we prefer calling npm from the actual workspace package directory itself. It's important to call npm from a directory that is an actual workspace (as per the workspaces configuration)
        // and not from, for example, `publishConfig.directory` because npm only resolves to the root's .npmrc for actual workspaces and not for arbitrary subdirectories of the root.
        cwd: pkg.dir,
        env,
      },
      authState,
    );
    return {
      name: release.name,
      version: release.version,
      result: publishConfirmation.result,
    };
  });

  return Promise.all(
    publishPromises.map(async (publishPromise) => {
      const result = await publishPromise;
      if (result.result === "published") {
        log.success(
          `Published ${c.blue(result.name)}@${c.green(result.version)}!`,
        );
      }
      return result;
    }),
  );
}
