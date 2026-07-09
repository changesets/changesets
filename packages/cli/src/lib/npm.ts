import path from "node:path";
import { exec } from "tinyexec";
import { isAlreadyPublishedError } from "./common.ts";
import type {
  PublishResultFailedNeeds2fa,
  PublishResult,
  PublishOptions,
  PublishTool,
} from "./types.ts";

export type NpmPublishENeedAuthError = {
  code: "ENEEDAUTH";
  summary: string;
  detail: string;
};

export type NpmPublishEOtpError = {
  code: "EOTP";
  summary: string;
  detail: string;
  authUrl?: string;
  /** returns `""` if not authed yet, `"[token]"` after user has authed */
  doneUrl?: string;
};

export type NpmPublishGenericError = {
  code?: string;
  summary: string;
  detail: string;
};

export type NpmPublishError = {
  error:
    | NpmPublishENeedAuthError
    | NpmPublishEOtpError
    | NpmPublishGenericError;
};

function isNpmPublishError(err: unknown): err is NpmPublishError {
  return (
    err != null &&
    typeof err === "object" &&
    "error" in err &&
    "summary" in (err as NpmPublishError).error
  );
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NPM_CONFIG_OTP: undefined,
    npm_config_otp: undefined,
    // TODO: verify if still a problem in Yarn v3+
    // Due to a super annoying issue in classic yarn, we have to manually strip this env variable.
    // The issue is that `yarn run` overrides the `npm_config_registry` env variable with its read-only mirror.
    // Then the publish command runs from within it and inherits that env variable. Env variable trumps config values
    // and even trumps the `yarn publish`'s default publish registry (npm one) so the whole thing ends up failing.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    npm_config_registry: undefined,
  };
}

// -- PublishTool -- //

export const name = "npm" satisfies PublishTool["name"];

export function getOtpCode(otp?: string): string | null {
  return (
    otp || process.env.NPM_CONFIG_OTP || process.env.npm_config_otp || null
  );
}

export function handlePublishError(
  resultBase: Pick<PublishResult, "name" | "version">,
  json: unknown,
  processOutput: string,
): PublishResult {
  // if we get back an unknown error
  if (!isNpmPublishError(json)) {
    return { ...resultBase, result: "failed", summary: processOutput };
  }

  // npm v11 doesn't return a `code` on already-published errors
  if (isAlreadyPublishedError(json.error.summary)) {
    // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
    return { ...resultBase, result: "skipped:already-published" };
  }

  const summary = `
${json.error.summary ?? ""}
${json.error.detail ?? ""}
  `.trim();

  if (json.error.code === "EOTP") {
    const result: PublishResultFailedNeeds2fa = {
      ...resultBase,
      result: "failed:needs-2fa",
      summary,
    };

    // npm v11 returns data we can use to handle 2fa in-process
    // TODO: handle "needs-2fa" result
    if ("authUrl" in json.error) {
      result.authUrl = json.error.authUrl;
      result.doneUrl = json.error.doneUrl;
    }

    return result;
  }

  return { ...resultBase, result: "failed", summary };
}

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
export async function publish({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}: PublishOptions): Promise<PublishResult> {
  // cwd is super important for correct resolution of `.npmrc`
  //
  // In the past, we wouldn't be able to call npm in the package directory itself, because despite npm's workspace support introduced in npm 7.
  // It wouldn't actually be particularly workspaces-aware until npm 9 (until https://github.com/npm/cli/pull/4372).
  // So we'd have to call npm from the root with a nested package target because `.npmrc` would resolve in respect to cwd and not the target package and that's what we wanted.
  // Nowadays, this isn't important as `.npmrc` lookup is workspace-aware and finds the root `.npmrc` just fine even if invoked from the package directory.
  //
  // So we prefer calling npm from the actual workspace package directory itself. It's important to call npm from a directory that is an actual workspace (as per the workspaces configuration)
  // and not from, for example, `publishConfig.directory` because npm only resolves to the root's `.npmrc` for actual workspaces and not for arbitrary subdirectories of the root.
  const cwd = pkg.dir;

  const args: string[] = [
    "--json",
    "--access",
    release.access,
    "--tag",
    release.tag,
  ];
  if (otpCode) args.push("--otp", otpCode);
  if (tarballPath) {
    args.unshift(path.relative(cwd, tarballPath));
  } else if (pkg.packageJson.publishConfig?.directory != null) {
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
    args.unshift(path.resolve(cwd, pkg.packageJson.publishConfig.directory));
  }

  const { exitCode, stdout, stderr } = await exec("npm", ["publish", ...args], {
    nodeOptions: {
      stdio: interactive ? "inherit" : "pipe",
      env: sanitizeEnv(process.env),
      cwd,
    },
  });
  const resultBase = { name: release.name, version: release.version };
  if (exitCode === 0) {
    return {
      ...resultBase,
      result: !interactive ? "published" : "published:interactive",
    };
  }

  /* -- error handling -- */

  if (interactive) {
    return { ...resultBase, result: "failed", summary: stderr || stdout };
  }

  let json: unknown;
  try {
    json = JSON.parse(stdout.toString().trim());
  } catch {
    return { ...resultBase, result: "failed", summary: stderr || stdout };
  }

  return handlePublishError(resultBase, json, stderr || stdout);
}
