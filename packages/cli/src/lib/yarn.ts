import { stripVTControlCharacters } from "node:util";
import { exec } from "tinyexec";
import { streamNdjson } from "../utils/streamNdjson.ts";
import {
  isAlreadyPublishedError,
  isStageConflictError,
  resolveStageConflict,
} from "./common.ts";
import type { PackageInfo, PublishResult, PublishTool } from "./types.ts";

// -- PublishTool -- //

export const name = "yarn" satisfies PublishTool["name"];

type YarnCommandError = {
  code?: string;
  message?: string;
};

type YarnReporterError = {
  code: string;
  message: string;
};

type YarnBerryReporterEvent = {
  type: "error";
  name: number;
  displayName?: string;
  data: string;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

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
): YarnReporterError | undefined {
  const errors: YarnReporterError[] = [];
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

export const info: PublishTool["info"] = async ({ cwd, pkg }) => {
  const { packageJson } = pkg;
  // Yarn doesn't support `yarn npm info --registry` even though it does support `publishConfig.registry` as a publish-time override.
  // But it also supports separate `npmRegistryServer` and `npmPublishRegistry` for the same scope.
  // So it seems that in their model we should be using the *fetch* registry for info queries *anyway*.
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
    const error: YarnCommandError = getYarnBerryReporterError(
      result.stdout,
    ) ?? { message: result.stderr || result.stdout };
    return error.code === "YN0035" &&
      error.message?.includes("Response Code: 404") === true
      ? { published: false }
      : { error };
  }

  let info: PackageInfo | undefined;
  for (const entry of streamNdjson(result.stdout)) {
    info = entry as PackageInfo;
  }
  return info ? { published: true, info } : { error: {} };
};

// Yarn's info command always uses the fetch registry. Resolve the publish
// registry explicitly for this public metadata query, including scoped settings.
export const publishedVersion: PublishTool["info"] = async ({ cwd, pkg }) => {
  async function config(key: string): Promise<unknown> {
    const result = await exec("yarn", ["config", "get", key, "--json"], {
      nodePath: false,
      nodeOptions: { cwd },
    });
    if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
    return result.stdout.trim() === "undefined"
      ? undefined
      : JSON.parse(result.stdout);
  }
  let registry: unknown = pkg.packageJson.publishConfig?.registry;
  if (!registry) {
    const [scopes, publishRegistry, fetchRegistry] = await Promise.all([
      config("npmScopes"),
      config("npmPublishRegistry"),
      config("npmRegistryServer"),
    ]);
    const scope = pkg.packageJson.name.startsWith("@")
      ? pkg.packageJson.name.slice(1).split("/")[0]
      : undefined;
    const scoped =
      scope && isJsonObject(scopes) && isJsonObject(scopes[scope])
        ? scopes[scope]
        : undefined;
    registry = scoped?.npmPublishRegistry ?? publishRegistry ?? fetchRegistry;
  }
  if (typeof registry !== "string")
    return { error: { message: "Unable to resolve the publishing registry." } };
  // Pending stage metadata is not needed. Public packuments work with OIDC
  // without obtaining a new token. Restricted registries fail closed.
  const response = await fetch(
    new URL(
      pkg.packageJson.name.replace("/", "%2f"),
      `${registry.replace(/\/$/, "")}/`,
    ),
    {
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (response.status === 404) return { published: false };
  if (!response.ok)
    return {
      error: {
        code: `HTTP${response.status}`,
        message: "Unable to query published versions.",
      },
    };
  const packument: unknown = await response.json();
  if (!isJsonObject(packument) || !isJsonObject(packument.versions))
    return { error: { message: "Invalid published versions response." } };
  return {
    published: true,
    info: { "dist-tags": {}, versions: Object.keys(packument.versions) },
  };
};

export const pack: PublishTool["pack"] = async ({ packDir, tarballPath }) => {
  const { exitCode, stdout, stderr } = await exec(
    "yarn",
    ["pack", "--out", tarballPath, "--json"],
    {
      nodePath: false,
      nodeOptions: { cwd: packDir },
    },
  );
  if (exitCode !== 0) {
    return {
      error: getYarnBerryReporterError(stdout) || { message: stderr || stdout },
    };
  }
  return { tarballPath };
};

export const getOtpCode: PublishTool["getOtpCode"] = (otp?: string) =>
  otp || null;

export const publish: PublishTool["publish"] = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
  stage,
}) => {
  const resultBase = { name: release.name, version: release.version };

  if (pkg.packageJson.publishConfig?.directory) {
    return {
      ...resultBase,
      result: "failed",
      message: `Package has publishConfig.directory configured in its package.json, which is not supported when using Yarn.`,
    } satisfies PublishResult;
  }

  // Yarn Berry only publishes the workspace at cwd; it doesn't accept a
  // tarball (or another directory) as a positional argument.
  if (tarballPath) {
    return {
      ...resultBase,
      result: "failed",
      message: "Yarn does not support publishing from a tarball.",
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
  if (stage) args.push("--staged");

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
    if (stage) {
      let stageId: string | undefined;
      for (const entry of streamNdjson(stdout)) {
        if (
          entry &&
          typeof entry === "object" &&
          "stageId" in entry &&
          typeof entry.stageId === "string"
        ) {
          stageId = entry.stageId;
        }
      }
      return {
        ...resultBase,
        result: "success",
        stageId,
      };
    }
    return {
      ...resultBase,
      result: "success",
    };
  }

  const reporterError = getYarnBerryReporterError(stdout);

  if (!reporterError) {
    return {
      ...resultBase,
      result: "failed",
      message: stderr || stdout,
    };
  }

  if (
    reporterError.code === "YN0035" &&
    ((!stage && isAlreadyPublishedError(reporterError.message)) ||
      (stage &&
        reporterError.message.includes("Response Code: 409 (Conflict)") &&
        isStageConflictError(reporterError.message)))
  ) {
    const result = {
      ...resultBase,
      result: "failed:already-done" as const,
      code: reporterError.code,
    };
    return stage
      ? resolveStageConflict(result, { cwd: pkg.dir, pkg }, publishedVersion)
      : result;
  }

  if (
    reporterError.code === "YN0033" ||
    /\b(otp|one-time password|authentication)\b/i.test(reporterError.message)
  ) {
    return {
      ...resultBase,
      result: "failed:needs-2fa",
      code: reporterError.code,
      message: reporterError.message,
    };
  }

  return {
    ...resultBase,
    result: "failed",
    code: reporterError.code,
    message: reporterError.message,
  };
};
