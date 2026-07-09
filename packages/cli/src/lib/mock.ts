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

export async function publish({
  pkg,
  release,
  tarballPath,
  // interactive,
  otpCode,
}: PublishOptions): Promise<PublishResult> {
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
    // support `publishConfig.directory`
    args.unshift(path.resolve(cwd, pkg.packageJson.publishConfig.directory));
  }

  if (process.env.CHANGESETS_MOCK_PUBLISH_LOGS) {
    console.log(
      `publishing ${release.name}@${release.version} from ${tarballPath ?? cwd}`,
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * 1500 + 500),
  );

  const resultBase = { name: release.name, version: release.version };
  const random = Math.random();
  if (random < 0.5) {
    return { ...resultBase, result: "published" };
  } else {
    return {
      ...resultBase,
      result: "failed",
      summary: "Fake publish failure...",
    };
  }
}
