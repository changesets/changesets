import { stripVTControlCharacters } from "node:util";
import { exec } from "tinyexec";
import {
  type FormattedPackageManagerError,
  isJsonObject,
} from "../utils/package-manager-errors.ts";
import { streamNdjson } from "../utils/streamNdjson.ts";
import {
  isAlreadyPublishedError,
  npmPublishQueue,
  npmRequestQueue,
} from "./common.ts";
import type { PackageInfo, PublishResult, PublishTool } from "./types.ts";

// -- PublishTool -- //

export const name = "yarn" satisfies PublishTool["name"];

type YarnBerryReporterEvent = {
  type: "error";
  name: number;
  displayName?: string;
  data: string;
};

function isYarnBerryReporterEvent(
  event: unknown,
): event is YarnBerryReporterEvent {
  if (!isJsonObject(event) || event.type !== "error") {
    return false;
  }

  return typeof event.name === "number" && typeof event.data === "string";
}

export function getYarnBerryReporterError(
  output: string,
): FormattedPackageManagerError | undefined {
  const errors: FormattedPackageManagerError[] = [];
  let code: string | undefined;

  for (const event of streamNdjson(output)) {
    if (!isYarnBerryReporterEvent(event)) {
      continue;
    }

    const error = {
      code:
        typeof event.displayName === "string" && event.displayName
          ? event.displayName
          : `YN${String(event.name).padStart(4, "0")}`,
      message: stripVTControlCharacters(event.data),
    };
    // this is YN0000 "summary" printed at the end, just skip it at all times
    if (error.message.startsWith("Failed with errors")) {
      continue;
    }
    if (errors.length > 0 && error.code !== code) {
      break;
    }

    code = error.code;
    errors.push(error);
  }

  if (!errors.length) {
    return;
  }

  return {
    code: errors[0].code,
    message: errors.map((error) => error.message).join("\n"),
  };
}

export const info: PublishTool["info"] = ({ cwd, pkg }) =>
  npmRequestQueue.add(async () => {
    const { packageJson } = pkg;
    // Yarn uses its fetch registry for info queries and doesn't support a
    // --registry override on `yarn npm info`.
    const result = await exec(
      "yarn",
      ["npm", "info", packageJson.name, "--json"],
      {
        nodePath: false,
        nodeOptions: { cwd },
      },
    );
    // Yarn Berry always returns useful bare-name output, even if the package
    // has no `latest` dist-tag, so it doesn't need npm/pnpm's exact fallback.
    // https://github.com/yarnpkg/berry/blob/0a230c14e71247576f6b51fa811ae08edb6608aa/packages/plugin-npm-cli/sources/commands/npm/info.ts#L124
    if (result.exitCode !== 0) {
      const error = getYarnBerryReporterError(result.stdout) ?? {
        code: "EUNKNOWN",
        message: result.stderr || result.stdout || "Unknown error",
      };
      return error.code === "YN0035" &&
        error.message?.includes("Response Code: 404") === true
        ? { published: false }
        : { error };
    }

    let pkgInfo: PackageInfo | undefined;
    for (const entry of streamNdjson(result.stdout)) {
      pkgInfo = entry as PackageInfo;
    }
    return pkgInfo
      ? { published: true, pkgInfo }
      : {
          error: {
            code: "EUNKNOWN",
            message: "Yarn returned no package info",
          },
        };
  });

export const pack: PublishTool["pack"] = async ({ packDir, tarballPath }) => {
  const { exitCode, stdout, stderr } = await exec(
    "yarn",
    ["pack", "--out", tarballPath, "--json"],
    {
      nodePath: false,
      nodeOptions: { cwd: packDir },
    },
  );
  return exitCode === 0
    ? { tarballPath }
    : {
        error: getYarnBerryReporterError(stdout) ?? {
          code: "EUNKNOWN",
          message: stderr || stdout || "Unknown error",
        },
      };
};

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

    if (
      publishError.code === "YN0033" ||
      /\b(otp|one-time password|authentication)\b/i.test(publishError.message)
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
