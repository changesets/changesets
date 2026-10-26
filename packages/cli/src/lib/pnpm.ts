import path from "node:path";
import { exec } from "tinyexec";
import { getLastJsonObjectFromString } from "../utils/getLastJsonObjectFromString.ts";
import { isAlreadyPublishedError } from "./common.ts";
import * as npm from "./npm.ts";
import type {
  InfoOptions,
  PackageInfo,
  PackageInfoResult,
  PackOptions,
  PackResult,
  PublishOptions,
  PublishResult,
  PublishTool,
} from "./types.ts";

type PnpmOptions = {
  major: number;
};

export type PnpmPublish2faRequiredError = {
  code: "ERR_PNPM_OTP_NON_INTERACTIVE";
  message: string;
  authUrl?: string;
  doneUrl?: string;
};

export type PnpmPublishGenericError = {
  code: "E403" | "E404";
  message: string;
};

export type PnpmPublishError = {
  error: PnpmPublishGenericError | PnpmPublish2faRequiredError;
};

function isPnpmPublishError(error: unknown): error is PnpmPublishError {
  return (
    error != null &&
    typeof error === "object" &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error != null &&
    "code" in error.error &&
    "message" in error.error
  );
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    PNPM_CONFIG_OTP: undefined,
    pnpm_config_otp: undefined,
    // pnpm 10 supported those so we clear them here too
    NPM_CONFIG_OTP: undefined,
    npm_config_otp: undefined,
  };
}

type PnpmCommandError = {
  code?: string;
  message?: string;
};

function getPnpmError(stderr: string, stdout: string): PnpmCommandError {
  const json = getLastJsonObjectFromString(stdout);
  const error = json?.error;
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return { message: stderr || stdout || undefined };
  }
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
  };
}

// -- PublishTool -- //

export const name = "pnpm" satisfies PublishTool["name"];

function parseInfoResult({
  exitCode,
  stdout,
  stderr,
}: import("tinyexec").Output):
  | { info: PackageInfo }
  | { error: PnpmCommandError }
  | undefined {
  if (exitCode !== 0) {
    return { error: getPnpmError(stderr, stdout) };
  }
  return stdout ? { info: JSON.parse(stdout) as PackageInfo } : undefined;
}

export async function info(
  { cwd, pkg }: InfoOptions,
  options: PnpmOptions,
): Promise<PackageInfoResult> {
  const { packageJson } = pkg;
  // In pnpm `publishConfig.registry` is the only supported registry value and it's a strong publish-time override.
  // However, pnpm's recursive publish doesn't use that to query which packages are already published:
  // https://github.com/pnpm/pnpm/blob/b4fdfe9b3381bde2b09c1aa8af9f31446b177c83/pnpm11/releasing/commands/src/publish/recursivePublish.ts#L85-L94
  //
  // We match that behavior and in pnpm we treat `publishConfig.registry` as a publish-time override only. So we don't use `--registry` here.
  const latestResult = await exec(
    "pnpm",
    ["info", packageJson.name, "--json"],
    {
      nodePath: false,
      nodeOptions: { cwd },
    },
  );
  let info =
    options.major <= 10
      ? npm.parseInfoResult(latestResult)
      : parseInfoResult(latestResult);
  if (
    !info ||
    ("error" in info && info.error.code === "ERR_PNPM_PACKAGE_NOT_FOUND")
  ) {
    const exactResult = await exec(
      "pnpm",
      ["info", `${packageJson.name}@${packageJson.version}`, "--json"],
      {
        nodePath: false,
        nodeOptions: { cwd },
      },
    );
    info = (options.major <= 10
      ? npm.parseInfoResult(exactResult)
      : parseInfoResult(exactResult)) ?? { error: { code: "E404" } };
  }
  if ("error" in info) {
    return info.error.code === "E404" ||
      info.error.code === "ERR_PNPM_FETCH_404" ||
      info.error.code === "ERR_PNPM_PACKAGE_NOT_FOUND"
      ? { published: false }
      : { error: info.error };
  }
  return { published: true, info: info.info };
}

export async function pack(
  { pkg, tarballPath }: PackOptions,
  options: PnpmOptions,
): Promise<PackResult> {
  // note: pnpm emits an object when packing a single package and an array when packing multiple packages
  // but with pnpm we don't even have to extract it from stdout as we are relying on explicitly configured --out
  const { exitCode, stdout, stderr } = await exec(
    "pnpm",
    ["pack", "--out", tarballPath, "--json"],
    {
      nodePath: false,
      nodeOptions: { cwd: pkg.dir },
    },
  );
  if (exitCode !== 0) {
    const json = getLastJsonObjectFromString(stdout);
    return {
      // pnpm 10 can return either pnpm or delegated npm errors here, so use
      // the output shape to keep pnpm lifecycle failures in pnpm's handler.
      error:
        options.major <= 10 && !isPnpmPublishError(json)
          ? npm.getCommandError(stdout, stderr)
          : getPnpmError(stderr, stdout),
    };
  }
  return { tarballPath };
}

export const getOtpCode: PublishTool["getOtpCode"] = (otp?: string) =>
  otp ||
  process.env.PNPM_CONFIG_OTP ||
  process.env.pnpm_config_otp ||
  process.env.NPM_CONFIG_OTP ||
  process.env.npm_config_otp ||
  null;

export async function publish(
  { pkg, release, tarballPath, interactive, otpCode }: PublishOptions,
  options: PnpmOptions,
): Promise<PublishResult> {
  const cwd = pkg.dir;
  // pnpm supports `publishConfig.directory` natively. We have to let it resolve it on its own.
  // Otherwise we'd risk it re-resolving from within the `publishConfig.directory` itself
  // but original untouched relative paths in `publishConfig.directory` would not even point to correct locations anymore.
  const args: string[] = [
    "--access",
    release.access,
    "--tag",
    release.tag,
    "--no-git-checks",
  ];
  if (!interactive) args.unshift("--json");
  if (otpCode) args.push("--otp", otpCode);
  if (tarballPath) args.unshift(path.relative(cwd, tarballPath));

  const { exitCode, stdout, stderr } = await exec(
    "pnpm",
    ["publish", ...args],
    {
      nodePath: false,
      nodeOptions: {
        stdio: interactive ? "inherit" : "pipe",
        env: sanitizeEnv(process.env),
        cwd,
      },
    },
  );
  const resultBase = { name: release.name, version: release.version };
  if (exitCode === 0) {
    return {
      ...resultBase,
      result: "published",
    };
  }

  /* -- error handling -- */

  const json = getLastJsonObjectFromString(stdout);
  if (!json) {
    return {
      ...resultBase,
      result: "failed",
      message: stderr || stdout || undefined,
    };
  }

  if (!isPnpmPublishError(json)) {
    // pnpm 10 delegates registry publishing to npm, but errors that happen
    // before that delegation, such as lifecycle failures, still use pnpm's
    // error shape. Only send non-pnpm output to npm's error handler.
    if (options.major <= 10) {
      return npm.handlePublishError(resultBase, json, stderr || stdout);
    }

    return {
      ...resultBase,
      result: "failed",
      message: stderr || stdout || undefined,
    };
  }

  if (isAlreadyPublishedError(json.error.message)) {
    // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
    return {
      ...resultBase,
      result: "failed:already-published",
      code: json.error.code,
    };
  }

  const message = json.error.message.trim();

  if (json.error.code === "ERR_PNPM_OTP_NON_INTERACTIVE") {
    return {
      ...resultBase,
      result: "failed:needs-2fa",
      code: json.error.code,
      message: message || undefined,
      authUrl: json.error.authUrl,
      doneUrl: json.error.doneUrl,
    } satisfies PublishResult;
  }

  return {
    ...resultBase,
    result: "failed",
    code: json.error.code,
    message: message || undefined,
  };
}
