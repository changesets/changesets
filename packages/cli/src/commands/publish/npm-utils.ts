import path from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import type { PackageJSON, Packages } from "@changesets/types";
import { log } from "@clack/prompts";
import { exec } from "tinyexec";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import {
  getPackageManagerError,
  isJsonObject,
} from "../../utils/package-manager-errors.ts";
import { streamNdjson } from "../../utils/streamNdjson.ts";
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
    let info: unknown;
    for (const entry of streamNdjson(output)) {
      if (publishTool.version === "berry") {
        // `yarn npm info --json` writes the payload we care about as a direct NDJSON object,
        // not wrapped in a reporter event like classic's `inspect`.
        info = entry;
        continue;
      }
      if (isJsonObject(entry) && entry.type === "inspect" && "data" in entry) {
        info = entry.data;
      }
    }

    return info;
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

function parseInfoResult(
  publishTool: PublishTool,
  { exitCode, stdout, stderr }: import("tinyexec").Output,
) {
  if (exitCode !== 0) {
    return {
      error: getPackageManagerError(publishTool, { stderr, stdout }),
    };
  }

  if (stdout) {
    return parseInfoOutput(publishTool, stdout);
  }

  // Successful empty stdout means the package manager found no matching data.
  // For npm this can happen when a package exists but has no `latest` dist-tag.
}

function getInfoCommand(publishTool: PublishTool) {
  return publishTool.name === "yarn" && publishTool.version === "berry"
    ? [publishTool.name, "npm", "info"]
    : [publishTool.name, "info"];
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

    const [infoTool, ...infoArgs] = getInfoCommand(publishTool);
    const infoFlags = [...registryOverrides, "--json"];

    // Bare query: when dist-tags.latest is set, returns the full `versions` array via packument
    // bleed-through, enabling only-pre detection downstream. Returns empty when no `latest` exists.
    let result = await exec(
      infoTool,
      [...infoArgs, packageJson.name, ...infoFlags],
      {
        nodeOptions: { cwd },
      },
    );

    const bareInfo = parseInfoResult(publishTool, result);
    if (
      bareInfo &&
      !(
        publishTool.name === "pnpm" &&
        isJsonObject(bareInfo) &&
        isJsonObject(bareInfo.error) &&
        bareInfo.error.code === "ERR_PNPM_PACKAGE_NOT_FOUND"
      )
    ) {
      return bareInfo;
    }

    // Bare query returned no successful output. Retry with an exact version
    // specifier: npm can return empty stdout for a package that exists but has
    // no `latest` dist-tag, while the exact version query can still return the
    // package metadata if this local version was already published.
    // pnpm has the same underlying `latest`-tag issue but reports it as
    // ERR_PNPM_PACKAGE_NOT_FOUND: fetchPackageInfo.ts builds a tag spec with
    // fetchSpec `latest`, and pickPackageFromMeta.ts resolves tag specs from
    // meta["dist-tags"].
    result = await exec(
      infoTool,
      [...infoArgs, `${packageJson.name}@${packageJson.version}`, ...infoFlags],
      { nodeOptions: { cwd } },
    );

    const exactInfo = parseInfoResult(publishTool, result);
    if (exactInfo) {
      return exactInfo;
    }

    // Normalize successful empty output, just in case. The above prerelease-only package query should already have returned:
    // - either a result (when the package+version exists)
    // - or an error with: "code": "E404", "summary": "No match found for version $VERSION",
    return {
      error: {
        code: "E404",
      },
    };
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
    pkgInfo.error?.code === "ERR_PNPM_PACKAGE_NOT_FOUND" ||
    // Yarn Berry: failed info requests are reporter errors. Missing packages
    // use YN0035 with the registry response code included in the joined data.
    (publishTool.name === "yarn" &&
      publishTool.version === "berry" &&
      pkgInfo.error?.code === "YN0035" &&
      pkgInfo.error.message.includes("Response Code: 404"))
  ) {
    log.warn(
      `Received 404 for ${c.cyan(
        [...getInfoCommand(publishTool), packageJson.name].join(" "),
      )}`,
    );
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    log.error(
      `
Received an unknown error code: ${pkgInfo.error.code} for ${c.cyan(
        [...getInfoCommand(publishTool), packageJson.name].join(" "),
      )}
${pkgInfo.error.message}
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

type InternalPublishResult =
  | { result: "published" }
  | { result: "skipped" }
  | { result: "failed"; allowRetry?: boolean };

function getPublishError(
  publishTool: PublishTool,
  stderr: string,
  stdout: string,
): { code: string; message: string } {
  const publishError = getPackageManagerError(publishTool, {
    stderr,
    stdout,
  });

  if (
    publishError.code === "EUNKNOWN" &&
    isAlreadyPublishedError(publishError.message)
  ) {
    // npm 11 started to reject "already published" publish attempts *eagerly* based on the preflight check
    // https://github.com/npm/cli/commit/31455b2e177b721292f3382726e3f5f3f2963b1d
    //
    // .code comes from the registry's endpoint response though:
    // https://github.com/npm/npm-registry-fetch/blob/6b4159a2519ce5aab26cc4dd8d4596a0b47781d2/lib/errors.js#L29
    // so it's not available for such eager errors, we normalize it to the code the registry would return in the case of an actual publish attempt
    return {
      code: "E403",
      message: publishError.message,
    };
  }

  return publishError;
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
