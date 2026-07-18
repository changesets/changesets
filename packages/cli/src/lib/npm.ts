import assert from "node:assert/strict";
import path from "node:path";
import type { PackageJSON } from "@changesets/types";
import { exec } from "tinyexec";
import { getLastJsonObjectFromString } from "../utils/getLastJsonObjectFromString.ts";
import { getNpmPnpmError } from "../utils/package-manager-errors.ts";
import {
  isAlreadyPublishedError,
  npmPublishQueue,
  npmRequestQueue,
} from "./common.ts";
import type {
  PackageInfo,
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
  if (!stdout) {
    return;
  }
  const parsed: unknown = JSON.parse(stdout);
  if (Array.isArray(parsed)) {
    // npm 12 stopped unwrapping single-version JSON results.
    if (parsed.length !== 1) {
      throw new Error("Unexpected array output from npm info --json");
    }
    return { pkgInfo: parsed[0] as PackageInfo };
  }
  return { pkgInfo: parsed as PackageInfo };
}

function getRegistryOverrides(packageJson: PackageJSON) {
  const registryOverrides: string[] = [];

  // npm publish uses publishConfig.registry when fetching package metadata.
  // Scoped registries take precedence over the plain registry flag.
  if (packageJson.name.startsWith("@")) {
    const scope = packageJson.name.split("/")[0];
    if (packageJson.publishConfig?.[`${scope}:registry`]) {
      registryOverrides.push(
        `--${scope}:registry=${packageJson.publishConfig[`${scope}:registry`]}`,
      );
    }
    if (packageJson.publishConfig?.registry) {
      registryOverrides.push(
        `--registry=${packageJson.publishConfig.registry}`,
      );
    }
  } else if (packageJson.publishConfig?.registry) {
    registryOverrides.push(`--registry=${packageJson.publishConfig.registry}`);
  }

  return registryOverrides;
}

export const info: PublishTool["info"] = ({ cwd, pkg }) =>
  npmRequestQueue.add(async () => {
    const { packageJson } = pkg;
    const flags = [...getRegistryOverrides(packageJson), "--json"];
    const latestResult = await exec(
      "npm",
      ["info", packageJson.name, ...flags],
      {
        nodePath: false,
        nodeOptions: { cwd },
      },
    );
    let info = parseInfoResult(latestResult);
    if (!info) {
      // A package without a latest dist-tag produces successful empty output for
      // the bare query. An exact query can still find the local version.
      const exactResult = await exec(
        "npm",
        ["info", `${packageJson.name}@${packageJson.version}`, ...flags],
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
      return info.error.code === "E404"
        ? { published: false }
        : { error: info.error };
    }
    return { published: true, pkgInfo: info.pkgInfo };
  });

export const pack: PublishTool["pack"] = async ({
  pkg,
  packDir,
  outputDir,
}) => {
  const { exitCode, stdout, stderr } = await exec(
    "npm",
    ["pack", packDir, "--pack-destination", outputDir, "--json"],
    {
      nodePath: false,
      nodeOptions: { cwd: pkg.dir },
    },
  );
  if (exitCode !== 0) {
    return { error: getNpmPnpmError({ stderr, stdout }) };
  }

  const json = getLastJsonObjectFromString(stdout);
  // npm<12 emits an array even when packing a single package.
  let filename = Array.isArray(json) ? json[0]?.filename : json?.filename;
  if (!filename) {
    // npm>=12 emits `{ [packageName]: { filename, ... } }`.
    const pkgOutput = Object.values(json ?? {})[0];
    filename =
      pkgOutput &&
      typeof pkgOutput === "object" &&
      "filename" in pkgOutput &&
      pkgOutput.filename;
  }
  assert(typeof filename === "string", "Failed to determine tarball filename");
  return { tarballPath: path.join(outputDir, path.basename(filename)) };
};

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
    return { ...resultBase, result: "failed:already-published" };
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
export const publish: PublishTool["publish"] = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}: PublishOptions): Promise<PublishResult> =>
  npmPublishQueue.add(async () => {
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

    const args: string[] = ["--access", release.access, "--tag", release.tag];
    if (!interactive) args.unshift("--json");
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

    const { exitCode, stdout, stderr } = await exec(
      "npm",
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

    return handlePublishError(resultBase, json, stderr || stdout);
  });
