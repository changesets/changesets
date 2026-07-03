import path from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import type { PackageJSON, Packages } from "@changesets/types";
import { log } from "@clack/prompts";
import { exec } from "tinyexec";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString.ts";
import type { AuthState } from "../../utils/types.ts";
import type { PublishReleaseEntry } from "../publish-plan/getPublishPlan.ts";

interface PublishOptions {
  /** The publish command argument, the path to the `publishConfig.directory` or tarball */
  target: string | undefined;
  /** The current working directory for the publish operation */
  cwd: string;
  /** The environment variables for the publish operation */
  env: NodeJS.ProcessEnv;
}

const NPM_REQUEST_CONCURRENCY_LIMIT = 40;
export const NPM_PUBLISH_CONCURRENCY_LIMIT = 10;

export const npmRequestQueue = createPromiseQueue(
  NPM_REQUEST_CONCURRENCY_LIMIT,
);
export const npmPublishQueue = createPromiseQueue(
  NPM_PUBLISH_CONCURRENCY_LIMIT,
);

function jsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("error parsing json:", input);
    }
    throw err;
  }
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

export function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.npm_config_registry === "https://registry.yarnpkg.com") {
    // Due to a super annoying issue in classic yarn, we have to manually strip this env variable.
    // The issue is that `yarn run` overrides the `npm_config_registry` env variable with its read-only mirror.
    // Then the publish command runs from within it and inherits that env variable. Env variable trumps config values
    // and even trumps the `yarn publish`'s default publish registry (npm one) so the whole thing ends up failing.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    return {
      ...env,
      npm_config_registry: undefined,
    };
  }
  return env;
}

type YarnPublishTool = {
  name: "yarn";
  version: "classic" | "berry";
};

export type PublishTool = { name: "npm" } | { name: "pnpm" } | YarnPublishTool;

async function getYarnVersion(
  packages: Packages,
): Promise<YarnPublishTool["version"]> {
  const { stdout } = await exec("yarn", ["--version"], {
    nodeOptions: {
      cwd: packages.rootDir,
    },
  });
  const major = Number(stdout.toString().trim().split(".")[0]);
  return Number.isNaN(major) || major >= 2 ? "berry" : "classic";
}

export async function getPublishTool(packages: Packages): Promise<PublishTool> {
  const { type } = packages.tool;
  if (type === "pnpm") {
    return { name: "pnpm" };
  }
  if (type === "yarn") {
    return { name: "yarn", version: await getYarnVersion(packages) };
  }
  return { name: "npm" };
}

function parseInfoOutput(publishTool: PublishTool, output: string) {
  if (publishTool.name === "yarn") {
    let cursor = output.length;

    while (cursor >= 0) {
      const lineStart = output.lastIndexOf("\n", cursor - 1) + 1;
      const line = output.slice(lineStart, cursor).trim();
      cursor = lineStart - 1;

      if (line.length === 0) {
        continue;
      }

      const entry = safeJsonParse(line);
      if (!entry) {
        continue;
      }
      if (publishTool.version === "berry") {
        // `yarn npm info --json` writes the payload we care about as a direct NDJSON object,
        // not wrapped in a reporter event like classic's `inspect`.
        return entry;
      }
      if (
        typeof entry === "object" &&
        entry != null &&
        "type" in entry &&
        entry.type === "inspect" &&
        "data" in entry
      ) {
        return entry.data;
      }
    }

    return undefined;
  }

  const parsedInfo = jsonParse(output);
  if (publishTool.name === "npm" && Array.isArray(parsedInfo)) {
    // npm 12 stopped unwrapping single-version JSON results. Changesets only
    // queries a bare name or an exact version, so more than one item would mean
    // npm matched a shape we don't intentionally request.
    if (parsedInfo.length !== 1) {
      throw new Error("Unexpected array output from npm info --json");
    }
    return parsedInfo[0];
  }
  return parsedInfo;
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
export function getPackageInfo(
  cwd: string,
  publishTool: PublishTool,
  packageJson: PackageJSON,
) {
  return npmRequestQueue.add(async () => {
    const registryOverrides: string[] = [];

    // Yarn Berry doesn't support `yarn npm info --registry` even though it does support `publishConfig.registry` as a publish-time override.
    // But it also supports separate `npmRegistryServer` and `npmPublishRegistry` for the same scope.
    // So it seems that in their model we should be using the *fetch* registry for info queries *anyway*.
    //
    // In pnpm `publishConfig.registry` is the only supported registry value and it's a strong publish-time override.
    // However, pnpm's recursive publish doesn't use that to query which packages are already published:
    // https://github.com/pnpm/pnpm/blob/b4fdfe9b3381bde2b09c1aa8af9f31446b177c83/pnpm11/releasing/commands/src/publish/recursivePublish.ts#L85-L94
    //
    // We match that behavior and in pnpm we treat `publishConfig.registry` as a publish-time override only.
    if (
      publishTool.name !== "pnpm" &&
      !(publishTool.name === "yarn" && publishTool.version === "berry")
    ) {
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
        // for non-scoped packages, it's a simple override
        registryOverrides.push(
          `--registry=${packageJson.publishConfig.registry}`,
        );
      }
    }

    const infoArgs =
      publishTool.name === "yarn" && publishTool.version === "berry"
        ? ["npm", "info"]
        : ["info"];
    const infoFlags = [...registryOverrides, "--json"];

    // Bare query: when dist-tags.latest is set, returns the full `versions` array via packument
    // bleed-through, enabling only-pre detection downstream. Returns empty when no `latest` exists.
    let result = await exec(
      publishTool.name,
      [...infoArgs, packageJson.name, ...infoFlags],
      {
        nodeOptions: { cwd },
      },
    );

    // Bare query returned nothing — retry with exact version specifier
    // to handle prerelease-only packages on registries without auto-`latest`.
    if (result.stdout.toString() === "") {
      result = await exec(
        publishTool.name,
        [
          ...infoArgs,
          `${packageJson.name}@${packageJson.version}`,
          ...infoFlags,
        ],
        { nodeOptions: { cwd } },
      );
    }

    // Normalize, just in case. The above prerelease-only package query should already have returned:
    // - either a result (when the package+version exists)
    // - or an error with: "code": "E404", "summary": "No match found for version $VERSION",
    if (result.stdout.toString() === "") {
      return {
        error: {
          code: "E404",
        },
      };
    }
    return parseInfoOutput(publishTool, result.stdout.toString());
  });
}

export async function infoAllow404(
  cwd: string,
  publishTool: PublishTool,
  packageJson: PackageJSON,
) {
  const pkgInfo = await getPackageInfo(cwd, publishTool, packageJson);
  if (
    pkgInfo.error?.code === "E404" ||
    // pnpm 11: the queried package does not exist in the registry.
    pkgInfo.error?.code === "ERR_PNPM_FETCH_404" ||
    // pnpm 11: the queried exact package version does not exist in the registry.
    pkgInfo.error?.code === "ERR_PNPM_PACKAGE_NOT_FOUND"
  ) {
    log.warn(`Received 404 for ${c.cyan(`npm info ${packageJson.name}`)}`);
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    log.error(
      `
Received an unknown error code: ${pkgInfo.error.code} for ${c.cyan(`npm info ${packageJson.name}`)}
${pkgInfo.error.summary}${pkgInfo.error.detail ? `\n${pkgInfo.error.detail}` : ""}
      `.trim(),
    );

    throw new ExitError(1);
  }
  return { published: true, pkgInfo };
}

// we check `npm info` before publishing but `npm info` can return stale data at times
// so we need to gracefully handle this situation
function isAlreadyPublishedError(output: string): boolean {
  return output.includes(
    "cannot publish over the previously published version",
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

type InternalPublishResult =
  | { result: "published" }
  | { result: "skipped" }
  | { result: "failed"; allowRetry?: boolean };

type PublishError = {
  code?: string;
  summary?: string;
  message?: string;
  detail?: string;
};

type FormattedPublishError = {
  code: string;
  message: string;
};

type YarnBerryReporterEvent = {
  type: "error";
  name: number;
  displayName: string;
  data: string;
};

function formatPublishError(
  publishTool: PublishTool["name"],
  error: PublishError,
): FormattedPublishError {
  // pnpm uses .message in tested versions; npm uses .summary
  const message =
    (publishTool === "pnpm"
      ? (error.message ?? error.summary)
      : error.summary) ?? "Unknown error";
  return {
    code:
      error.code ??
      // npm 11 started to reject "already published" publish attempts *eagerly* based on the preflight check
      // https://github.com/npm/cli/commit/31455b2e177b721292f3382726e3f5f3f2963b1d
      //
      // .code comes from the registry's endpoint response though:
      // https://github.com/npm/npm-registry-fetch/blob/6b4159a2519ce5aab26cc4dd8d4596a0b47781d2/lib/errors.js#L29
      // so it's not available for such eager errors, we normalize it to the code the registry would return in the case of an actual publish attempt
      (isAlreadyPublishedError(message) ? "E403" : "EUNKNOWN"),
    // .detail is npm-specific but for simplicity we handle it at all times
    message: `${message}${error.detail ? `\n${error.detail}` : ""}`,
  };
}

function isYarnBerryReporterEvent(
  event: unknown,
): event is YarnBerryReporterEvent {
  if (!isJsonObject(event) || event.type !== "error") {
    return false;
  }

  return (
    typeof event.name === "number" &&
    typeof event.displayName === "string" &&
    typeof event.data === "string"
  );
}

function* streamNdjson(output: string): Generator<unknown> {
  let lineStart = 0;
  while (lineStart <= output.length) {
    let lineEnd = output.indexOf("\n", lineStart);
    if (lineEnd === -1) {
      lineEnd = output.length;
    }

    const line = output.slice(lineStart, lineEnd);
    lineStart = lineEnd + 1;

    if (/^\s*$/.test(line)) {
      continue;
    }

    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    yield event;
  }
}

function formatYarnBerryReporterError(
  event: YarnBerryReporterEvent,
): FormattedPublishError {
  return {
    code:
      event.displayName ||
      // Yarn emits an empty displayName when enableMessageNames is false.
      `YN${String(event.name).padStart(4, "0")}`,
    message: event.data,
  };
}

function getYarnBerryReporterError(
  output: string,
): FormattedPublishError | undefined {
  const errors: FormattedPublishError[] = [];
  let code: string | undefined;

  for (const event of streamNdjson(output)) {
    if (!isYarnBerryReporterEvent(event)) {
      continue;
    }

    const error = formatYarnBerryReporterError(event);
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

function getPublishError(
  publishTool: PublishTool,
  stderr: string,
  stdout: string,
): { code: string; message: string } | undefined {
  if (publishTool.name === "yarn" && publishTool.version === "berry") {
    return getYarnBerryReporterError(stdout);
  }

  // NPM's --json output is included alongside the `prepublish` and `postpublish` output in terminal
  // We want to handle this as best we can but it has some struggles:
  // - output of those lifecycle scripts can contain JSON
  // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
  // - npm9 switched back to printing `--json` errors to stdout (https://github.com/npm/cli/commit/d3543e945e721783dcb83385935f282a4bb32cf3)
  // Note that the `--json` output is always printed at the end so this should work
  const json =
    getLastJsonObjectFromString(stderr) || getLastJsonObjectFromString(stdout);

  if (json?.error) {
    return formatPublishError(publishTool.name, json.error);
  }

  return undefined;
}

function isDuplicatePublishError(publishError: {
  code: string;
  message: string;
}): boolean {
  return (
    (publishError.code === "E403" ||
      publishError.code === "ERR_PNPM_FAILED_TO_PUBLISH" ||
      publishError.code === "YN0035") &&
    isAlreadyPublishedError(publishError.message)
  );
}

function isInteractiveAuthError(
  publishTool: PublishTool,
  publishError: { code: string; message: string },
): boolean {
  if (publishTool.name === "yarn" && publishTool.version === "berry") {
    return (
      publishError.code === "YN0033" ||
      /\b(otp|one-time password|authentication)\b/i.test(publishError.message)
    );
  }

  if (
    publishError.code === "EOTP" ||
    publishError.code === "ERR_PNPM_OTP_NON_INTERACTIVE"
  ) {
    return true;
  }

  if (publishError.code === "E401") {
    return publishError.message.includes("--otp=<code>");
  }

  return false;
}

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  publishTool: PublishTool,
  release: PublishReleaseEntry,
  opts: PublishOptions,
  authState: AuthState,
): Promise<InternalPublishResult> {
  const publishArgs =
    publishTool.name === "yarn" && publishTool.version === "berry"
      ? ["npm", "publish"]
      : ["publish"];
  if (opts.target) {
    publishArgs.push(path.relative(opts.cwd, opts.target));
  }
  const publishFlags = ["--access", release.access, "--tag", release.tag];
  if (publishTool.name === "pnpm") {
    publishFlags.push("--no-git-checks");
  } else if (publishTool.name === "yarn" && publishTool.version === "classic") {
    publishFlags.push("--new-version", release.version, "--no-git-tag-version");
    if (!process.stdin.isTTY) {
      publishFlags.push("--non-interactive");
    }
  }

  if (process.stdin.isTTY && authState.requiresInteractive) {
    // it's not easily controllable but ideally no other work should happen until this is done
    // we specifically don't want any other output to interfere with the delegated auth flow
    const child = exec(publishTool.name, [...publishArgs, ...publishFlags], {
      nodeOptions: {
        env: opts.env,
        cwd: opts.cwd,
        stdio: ["inherit", "inherit", "pipe"],
      },
    });

    const result = await child;

    if (child.exitCode === 0) {
      authState.requiresInteractive = false;
      // bump for remaining packages
      npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
      return { result: "published" };
    }

    // in the delegated mode all tested npm versions (v3-v10) log the error to stderr
    if (isAlreadyPublishedError(result.stderr.toString())) {
      // given this error happened in the delegated mode, the user was prompted to log in
      // for that reason, it's nice to show this warning to the user so they are not confused by the printed error
      log.warn(
        `${release.name} is already published (likely a stale registry data led to a duplicate publish attempt)`,
      );
      authState.requiresInteractive = false;
      npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
      return { result: "skipped" };
    }

    return { result: "failed" };
  }

  // in the delegated mode we don't need the json output
  // as we won't be handling the auth errors
  publishFlags.push("--json");
  if (authState.otpToken) {
    publishFlags.push("--otp", authState.otpToken);
  }

  const { exitCode, stdout, stderr } = await exec(
    publishTool.name,
    [...publishArgs, ...publishFlags],
    {
      nodeOptions: {
        env: opts.env,
        cwd: opts.cwd,
      },
    },
  );

  if (exitCode !== 0) {
    const publishError = getPublishError(
      publishTool,
      stderr.toString(),
      stdout.toString(),
    );

    if (publishError) {
      if (isDuplicatePublishError(publishError)) {
        // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
        return { result: "skipped" };
      }
      // Retry in delegated interactive mode when the publish tool reports that OTP/web auth is required:
      // - npm uses EOTP for missing auth, or E401 + an --otp hint for an invalid/expired OTP
      // - pnpm uses ERR_PNPM_OTP_NON_INTERACTIVE when the JSON-capturing child process cannot prompt
      // - Yarn Berry reports auth failures as reporter errors such as YN0033
      if (
        isInteractiveAuthError(publishTool, publishError) &&
        process.stdin.isTTY
      ) {
        // the current otp code must be invalid since it errored
        authState.otpToken = undefined;
        authState.requiresInteractive = true;
        npmPublishQueue.setConcurrency(1);
        return {
          result: "failed",
          // given we have just adjusted the concurrency, we need to handle the retries in the layer that requeues the publish
          // calling internalPublish again would allow concurrent failures to run again concurrently
          // but only one retried publish should get delegated to the npm cli and other ones should "await" its successful result before being retried
          allowRetry: true,
        };
      }
      log.error(
        `
An error occurred while publishing ${release.name}: ${publishError.code}
${publishError.message}
        `.trim(),
      );
    }

    log.error(stderr.toString() || stdout.toString());
    return { result: "failed" };
  }
  // bump the limit up in case we have started with the limit of 1 in the TTY mode
  npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
  return { result: "published" };
}

export function publish(
  publishTool: PublishTool,
  release: PublishReleaseEntry,
  opts: PublishOptions,
  authState: AuthState,
): Promise<{ result: "published" | "skipped" | "failed" }> {
  return npmRequestQueue.add(async () => {
    let result: InternalPublishResult;
    do {
      result = await npmPublishQueue.add(() =>
        internalPublish(publishTool, release, opts, authState),
      );
    } while (result.result === "failed" && result.allowRetry);

    return { result: result.result };
  });
}
