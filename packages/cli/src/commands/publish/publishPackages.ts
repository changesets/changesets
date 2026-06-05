import { resolve } from "node:path";
import c from "@changesets/color";
import type { Package } from "@changesets/types";
import { log, progress } from "@clack/prompts";
import type { TwoFactorState } from "../../utils/types.ts";
import {
  getTokenIsRequired,
  npmPublishQueue,
  publish,
  type PublishTool,
  getPublishTool,
  sanitizeEnv,
} from "./npm-utils.ts";
import type { PublishReleaseEntry } from "../publish-plan/getPublishPlan.ts";
import type { Packages } from "@changesets/types";

export type PublishedResult = {
  name: string;
  version: string;
  result: "published" | "skipped" | "failed";
};

const getTwoFactorState = async (publishTool: PublishTool, {
  otp
}: {
  otp?: string;
}): Promise<TwoFactorState> => {
  if (otp) {
    return {
      token: otp,
      isRequired: true,
    };
  }

  if (publishTool.name === "pnpm" && process.env.PNPM_CONFIG_OTP) {
    return {
      token: process.env.PNPM_CONFIG_OTP,
      isRequired: true,
    }
  } else if (process.env.NPM_CONFIG_OTP) {
    return {
      token: process.env.NPM_CONFIG_OTP,
      isRequired: true,
    }
  }

  if (
    !process.stdin.isTTY
  ) {
    return {
      token: undefined,
      isRequired: false,
    };
  }

  return {
    token: undefined,
    isRequired: await getTokenIsRequired(),
  };
};

export const requiresDelegatedAuth = (twoFactorState: TwoFactorState) => {
  return (
    process.stdin.isTTY &&
    !twoFactorState.token &&
    !twoFactorState.allowConcurrency &&
    twoFactorState.isRequired
  );
};

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
  const publishTool = getPublishTool(packages.tool);
  const twoFactorState = await getTwoFactorState(publishTool, { otp });
  const env = sanitizeEnv({
    ...process.env,
    // we take over OTP handling in our TwoFactorState, so we unset those env variables so they don't become stale once we start updating expired OTPs
    ...(publishTool.name === "pnpm" ? { PNPM_CONFIG_OTP: undefined } : {  NPM_CONFIG_OTP: undefined }),
  });
  const hasToDelegate = requiresDelegatedAuth(twoFactorState);
  if (hasToDelegate) {
    npmPublishQueue.setConcurrency(1);
  }

  const packagesByName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));
  const publishPromises = releases.map(async (release) =>
    {
      let target: string
      if (artifactDir) {
        target = resolve(artifactDir, release.tarball!.path)
      } else if (publishTool.name === 'pnpm') {
        // pnpm supports `publishConfig.directory` natively. We have to let it resolve it on its own.
        // Otherwise we'd risk it re-resolving from within the `publishConfig.directory` itself
        // but original untouched relative paths in `publishConfig.directory` would not even point to correct locations anymore.
        target = packagesByName.get(release.name)!.dir;
      } else {
        const pkg = packagesByName.get(release.name)!;
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
        target = pkg.packageJson.publishConfig?.directory ? resolve(pkg.dir, pkg.packageJson.publishConfig.directory) : pkg.dir;
      }
      const publishConfirmation = await publish(
        publishTool,
        release,
        {
          target,
          // cwd is super important for correct resolution of .npmrc
          // in the past, we wouldn't be able to call npm in the package directory itself, because despite npm's workspace support introduced in npm 7
          // it wouldn't actually be particularly workspaces-aware until npm 9 (until https://github.com/npm/cli/pull/4372).
          // So we'd have to call npm from the root with a nested package target (essentially what we still do now)
          // because .npmrc would resolve in respect to cwd and not the target package and that's what we wanted.
          // Nowadays, this isn't as important as .npmrc lookup is workspace-aware and would find the root .npmrc just fine even if invoked from the package directory.
          // 
          // However, there are still 2 reasons why we prefer to set it to the root:
          // 1. it's a consistent approach that works across package managers and it's also a good location when publishing packed artifacts
          // 2. it's important not to call npm from a directory that is an actual workspace (as per the workspaces configuration) and not from, for example, publishConfig.directory
          //    because npm only resolves to the root's .npmrc for actual workspaces and not for arbitrary subdirectories of the root.
          cwd: packages.rootDir,
          env,
        },
        twoFactorState,
      )
      return {
        name: release.name,
        version: release.version,
        result: publishConfirmation.result,
      }
    }
  );

  if (!hasToDelegate && releases.length > 1) {
    const p = progress({ max: releases.length });
    p.start("Publishing packages...");

    const results = await Promise.all(
      publishPromises.map(async (publishPromise) => {
        const result = await publishPromise;
        p.advance();
        return result;
      }),
    );

    p.stop(`Published ${publishPromises.length} packages!`);
    return results;
  } else {
    return Promise.all(
      publishPromises.map(async (publishPromise) => {
        const result = await publishPromise;
        log.success(
          `Published ${c.blue(result.name)}@${c.green(result.version)}!`,
        );
        return result;
      }),
    );
  }
}
