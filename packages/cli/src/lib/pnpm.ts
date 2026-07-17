import path from "node:path";
import { exec } from "tinyexec";
import { getNpmPnpmError } from "../utils/package-manager-errors.ts";
import {
  isAlreadyPublishedError,
  npmPublishQueue,
  npmRequestQueue,
} from "./common.ts";
import * as npm from "./npm.ts";
import type { PackageInfo, PublishResult, PublishTool } from "./types.ts";

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

// -- PublishTool -- //

export const name = "pnpm" satisfies PublishTool["name"];

function parseInfoResult({
  exitCode,
  stdout,
  stderr,
}: import("tinyexec").Output):
  | { pkgInfo: PackageInfo }
  | { error: { code: string; message?: string } }
  | undefined {
  if (exitCode !== 0) {
    return { error: getNpmPnpmError({ stderr, stdout }) };
  }
  return stdout ? { pkgInfo: JSON.parse(stdout) as PackageInfo } : undefined;
}

export const info: PublishTool["info"] = ({ cwd, pkg }) =>
  npmRequestQueue.add(async () => {
    const { packageJson } = pkg;
    // pnpm treats publishConfig.registry as a publish-time override only,
    // matching its recursive publish implementation.
    const latestResult = await exec(
      "pnpm",
      ["info", packageJson.name, "--json"],
      {
        nodePath: false,
        nodeOptions: { cwd },
      },
    );
    let info = parseInfoResult(latestResult);
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
      info = parseInfoResult(exactResult) ?? {
        error: { code: "E404" },
      };
    }
    if ("error" in info) {
      return info.error.code === "E404" ||
        info.error.code === "ERR_PNPM_FETCH_404" ||
        info.error.code === "ERR_PNPM_PACKAGE_NOT_FOUND"
        ? { published: false }
        : { error: info.error };
    }
    return { published: true, pkgInfo: info.pkgInfo };
  });

export const getOtpCode: PublishTool["getOtpCode"] = (otp?: string) =>
  otp ||
  process.env.PNPM_CONFIG_OTP ||
  process.env.pnpm_config_otp ||
  process.env.NPM_CONFIG_OTP ||
  process.env.npm_config_otp ||
  null;

export const publish: PublishTool["publish"] = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}) =>
  npmPublishQueue.add(async () => {
    const cwd = pkg.dir;
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
        result: !interactive ? "published" : "published:interactive",
      };
    }

    /* -- error handling -- */

    let json: unknown;
    try {
      json = JSON.parse(stdout.toString().trim());
    } catch {
      return { ...resultBase, result: "failed", summary: stderr || stdout };
    }

    // let the npm error handler take care of any other non-json error, as pnpm 10 delegates publishing to npm
    // TODO: use normal JSON parsing error handling after dropping pnpm 10 support
    if (!isPnpmPublishError(json)) {
      return npm.handlePublishError(resultBase, json, stderr || stdout);
    }

    if (isAlreadyPublishedError(json.error.message)) {
      // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
      return { ...resultBase, result: "failed:already-published" };
    }

    const summary = json.error.message.trim();

    if (
      json.error.code === "ERR_PNPM_OTP_NON_INTERACTIVE" &&
      process.stdin.isTTY === true
    ) {
      return {
        ...resultBase,
        result: "failed:needs-2fa",
        summary,
        authUrl: json.error.authUrl,
        doneUrl: json.error.doneUrl,
      } satisfies PublishResult;
    }

    return { ...resultBase, result: "failed", summary };
  });
