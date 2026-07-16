import { exec } from "tinyexec";
import { getYarnBerryReporterError } from "../utils/package-manager-errors.ts";
import { isAlreadyPublishedError, npmPublishQueue } from "./common.ts";
import type { PublishResult, PublishTool } from "./types.ts";

// -- PublishTool -- //

export const name = "yarn" satisfies PublishTool["name"];

export const getOtpCode: PublishTool["getOtpCode"] = (otp?: string) =>
  otp || null;

export const publish: PublishTool["publish"] = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}) =>
  npmPublishQueue.add(async () => {
    const resultBase = { name: release.name, version: release.version };

    // Yarn Berry only publishes the workspace at cwd; it doesn't accept a
    // tarball (or another directory) as a positional argument.
    if (tarballPath) {
      return {
        ...resultBase,
        result: "failed",
        summary: "Yarn does not support publishing from a tarball.",
      } satisfies PublishResult;
    }

    const args = [
      "npm",
      "publish",
      "--access",
      release.access,
      "--tag",
      release.tag,
    ];
    if (!interactive) args.push("--json");
    if (otpCode) args.push("--otp", otpCode);

    const { exitCode, stdout, stderr } = await exec("yarn", args, {
      nodePath: false,
      // Work around Yarn Berry prompting for OTP on stdin instead of reporting
      // the auth failure in the JSON-capturing child process. Fixed upstream in:
      // https://github.com/yarnpkg/berry/pull/7209
      ...(!interactive && { stdin: "not-otp\n" }),
      nodeOptions: {
        cwd: pkg.dir,
        stdio: interactive ? "inherit" : "pipe",
      },
    });

    if (exitCode === 0) {
      return {
        ...resultBase,
        result: interactive ? "published:interactive" : "published",
      };
    }

    const publishError = getYarnBerryReporterError(stdout) ?? {
      code: "EUNKNOWN",
      message: stderr || stdout || "Unknown error",
    };

    if (
      publishError.code === "YN0035" &&
      isAlreadyPublishedError(publishError.message)
    ) {
      return { ...resultBase, result: "failed:already-published" };
    }

    // Yarn reports registry authentication and OTP failures using reporter
    // errors rather than npm's EOTP-shaped JSON errors.
    if (
      !interactive &&
      process.stdin.isTTY &&
      (publishError.code === "YN0033" ||
        /\b(otp|one-time password|authentication)\b/i.test(
          publishError.message,
        ))
    ) {
      return {
        ...resultBase,
        result: "failed:needs-2fa",
        summary: publishError.message,
      };
    }

    return {
      ...resultBase,
      result: "failed",
      summary: publishError.message,
    };
  });
