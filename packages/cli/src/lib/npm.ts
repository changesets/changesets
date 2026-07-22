import assert from "node:assert/strict";
import path from "node:path";
import type { PackageJSON } from "@changesets/types";
import { exec } from "tinyexec";
import { getLastJsonObjectFromString } from "../utils/getLastJsonObjectFromString.ts";
import { isAlreadyPublishedError } from "./common.ts";
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
    err.error != null &&
    typeof err.error === "object" &&
    "summary" in err.error
  );
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NPM_CONFIG_OTP: undefined,
    npm_config_otp: undefined,
  };
}

type NpmCommandError = {
  code?: string;
  message?: string;
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function formatJsonError(error: unknown): NpmCommandError | undefined {
  if (!isJsonObject(error)) return;

  let message =
    typeof error.message === "string"
      ? error.message
      : typeof error.summary === "string"
        ? error.summary
        : undefined;
  if (typeof error.detail === "string" && error.detail) {
    message = message ? `${message}\n${error.detail}` : error.detail;
  }

  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message,
  };
}

function getNpmError(stdout: string, stderr: string): NpmCommandError {
  // NPM's --json output can be included alongside lifecycle scripts' output, like `prepublish` and `postpublish`, in terminal.
  // Lifecycle scripts can contain JSON but `--json` output is always printed at the end so this should work
  // historical notes:
  // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
  // - npm9 switched back to printing `--json` errors to stdout (https://github.com/npm/cli/commit/d3543e945e721783dcb83385935f282a4bb32cf3)
  const json = getLastJsonObjectFromString(stdout);
  if (json?.error) {
    const jsonError = formatJsonError(json.error);
    if (jsonError) {
      return jsonError;
    }
  }
  return { message: stderr || stdout || undefined };
}

// -- PublishTool -- //

export const name = "npm" satisfies PublishTool["name"];

function parseInfoResult({
  exitCode,
  stdout,
  stderr,
}: import("tinyexec").Output):
  | { info: PackageInfo }
  | { error: NpmCommandError }
  | undefined {
  if (exitCode !== 0) {
    return { error: getNpmError(stdout, stderr) };
  }
  if (!stdout) {
    // Successful empty stdout means the package manager found no matching data but the package does exist in the registry.
    // For npm this can happen when a package exists but has no `latest` dist-tag.
    return;
  }
  const parsed: unknown = JSON.parse(stdout);
  if (Array.isArray(parsed)) {
    // npm 12 stopped unwrapping single-version JSON results. Changesets only
    // queries a bare name or an exact version, so more than one item would mean
    // npm matched a shape we don't intentionally request.
    assert(
      parsed.length === 1,
      "Unexpected empty array output from npm info --json",
    );
    return { info: parsed[0] as PackageInfo };
  }
  return { info: parsed as PackageInfo };
}

function getRegistryOverrides(packageJson: PackageJSON) {
  const registryOverrides: string[] = [];

  // npm actually uses the `publishConfig.registry` value when querying package info during publish:
  // https://github.com/npm/cli/blob/ed729620b1297f44ccf2517fd19fbaffdc225ed9/lib/commands/publish.js#L150
  //
  // for a scoped package the priority of registry resolution in `npm info` is:
  // --@scope:registry
  // .npmrc @scope:registry=
  // --registry
  // .npmrc registry=
  //
  // so we can't rely on a simple --registry override here
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

// `npm info <pkg> --json` (aka `npm view`) behavior:
//
// - Bare package name starts with version string `'latest'`. If
//   `dist-tags['latest']` exists, it's replaced with that value (e.g.
//   `'1.0.0'`). Then ALL versions are filtered through
//   `semver.satisfies(v, version, loose=true)`. When `latest` resolved to
//   an exact version, this is effectively an exact match. When `latest`
//   doesn't exist, the literal string `'latest'` reaches satisfies and
//   matches nothing — zero results, empty stdout.
// - Prereleases are invisible: satisfies runs WITHOUT `includePrerelease`,
//   so no range (not even `*`) matches prerelease versions.
// - When at least one version matches, the JSON output includes a `versions`
//   array with ALL published versions including prereleases (bleeds through
//   from the packument, unfiltered).
// - npmjs.org auto-assigns `latest` on first publish in addition to the
//   provided --tag, so bare queries always work there. GitHub Packages does
//   NOT auto-assign `latest`, so the empty-stdout case above applies.
// - `npm info <pkg>@<exact-prerelease> --json` works as long as that
//   version exists on the registry: exact strings pass `semver.satisfies`,
//   and the output still includes the full `versions` history (same
//   packument merge). Returns empty when the version doesn't exist yet.
// - Consequence: the exact-version fallback only provides data when
//   localVersion is already published. For a new unpublished version both
//   queries return empty → no versions list → only-pre detection is not
//   possible. Such packages (e.g. GitHub Packages with no auto-latest) are
//   published with preState.tag rather than "latest".
export const info: PublishTool["info"] = async ({ cwd, pkg }) => {
  const { packageJson } = pkg;
  const flags = [...getRegistryOverrides(packageJson), "--json"];
  const latestResult = await exec("npm", ["info", packageJson.name, ...flags], {
    nodePath: false,
    nodeOptions: { cwd },
  });
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
  return { published: true, info: info.info };
};

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
    return { error: getNpmError(stdout, stderr) };
  }

  // npm is the only package manager that doesn't support an explicit output path for the tarball
  // it still uses a pretty stable pattern for the output filename:
  // https://github.com/npm/cli/blob/42b12c250ff3e2ecd756fd82666454ebafc9386c/lib/utils/tar.js#L101-L103
  // we prefer to extract it explicitly, just in case
  const json = getLastJsonObjectFromString(stdout);
  // npm<12 emits an array even when packing a single package.
  let filename = Array.isArray(json) ? json[0]?.filename : json?.filename;
  if (!filename) {
    // npm>=12 introduced a breaking change: https://github.com/npm/cli/pull/9247
    // since that PR it emits `{ [packageName: string]: { filename: string, ... } }`
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
    return {
      ...resultBase,
      result: "failed",
      message: processOutput || undefined,
    };
  }

  // npm v11 doesn't return a `code` on already-published errors
  if (isAlreadyPublishedError(json.error.summary)) {
    // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
    return {
      ...resultBase,
      result: "failed:already-published",
      code: json.error.code!,
    };
  }

  const message = `
${json.error.summary ?? ""}
${json.error.detail ?? ""}
  `.trim();

  if (json.error.code === "EOTP") {
    const result: PublishResultFailedNeeds2fa = {
      ...resultBase,
      result: "failed:needs-2fa",
      code: json.error.code,
      message: message || undefined,
    };

    // npm v11 returns data we can use to handle 2fa in-process
    if ("authUrl" in json.error) {
      result.authUrl = json.error.authUrl;
      result.doneUrl = json.error.doneUrl;
    }

    return result;
  }

  return {
    ...resultBase,
    result: "failed",
    code: json.error.code,
    message: message || undefined,
  };
}

export const publish: PublishTool["publish"] = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}: PublishOptions): Promise<PublishResult> => {
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
    // npm doesn't support `publishConfig.directory` natively.
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
    nodePath: false,
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
      result: "published",
    };
  }

  /* -- error handling -- */

  const json = getLastJsonObjectFromString(stdout);
  if (!json) {
    return {
      ...resultBase,
      result: "failed",
      message: stderr || stdout,
    };
  }

  return handlePublishError(resultBase, json, stderr || stdout);
};
