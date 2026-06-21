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
  /** The publish command argument, the path to the package or tarball */
  target: string;
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

export type PublishTool = { name: "npm" } | { name: "pnpm" };

export function getPublishTool({ type }: Packages["tool"]): PublishTool {
  return { name: type === "pnpm" ? "pnpm" : "npm" };
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
  publishTool: PublishTool,
  packageJson: PackageJSON,
) {
  return npmRequestQueue.add(async () => {
    const registryOverrides: string[] = [];

    // In pnpm `publishConfig.registry` is the only supported registry value and it's a strong publish-time override.
    // However, pnpm's recursive publish doesn't use that to query which packages are already published:
    // https://github.com/pnpm/pnpm/blob/b4fdfe9b3381bde2b09c1aa8af9f31446b177c83/pnpm11/releasing/commands/src/publish/recursivePublish.ts#L85-L94
    //
    // We match that behavior and in pnpm we treat `publishConfig.registry` as a publish-time override only, and we don't use it to query the registry for existing versions.
    // It's a poorly documented manifest option anyway (docs don't mention it at all).
    if (publishTool.name !== "pnpm") {
      // npm actually uses the `publishConfig.registry` value when querying package info during publish:
      // https://github.com/npm/cli/blob/ed729620b1297f44ccf2517fd19fbaffdc225ed9/lib/commands/publish.js#L150
      //
      // Note that at this point the `opts` can actually be already mutates by the `#getManifest` call.
      //
      // It doesn't actually implement `isAlreadyPublished`-like early out for already published workspaces
      // but it still performs the `npm info`-like query to validate certain things about the package.
      // We treat this as a strong signal that `publishConfig.registry` in npm is also meant to be a read-time registry target.
      if (packageJson.name.startsWith("@")) {
        // For a scoped package the priority of registry resolution in `npm info` is:
        // --@scope:registry
        // .npmrc @scope:registry=
        // --registry
        // .npmrc registry=
        //
        // so we can't rely on a simple --registry override here
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

    // Bare query: when dist-tags.latest is set, returns the full `versions` array via packument
    // bleed-through, enabling only-pre detection downstream. Returns empty when no `latest` exists.
    let result = await exec(publishTool.name, [
      "info",
      packageJson.name,
      ...registryOverrides,
      "--json",
    ]);

    // Bare query returned nothing — retry with exact version specifier
    // to handle prerelease-only packages on registries without auto-`latest`.
    if (result.stdout.toString() === "") {
      result = await exec(publishTool.name, [
        "info",
        `${packageJson.name}@${packageJson.version}`,
        ...registryOverrides,
        "--json",
      ]);
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
    return jsonParse(result.stdout.toString());
  });
}

export async function infoAllow404(
  publishTool: PublishTool,
  packageJson: PackageJSON,
) {
  const pkgInfo = await getPackageInfo(publishTool, packageJson);
  if (pkgInfo.error?.code === "E404") {
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

type InternalPublishResult =
  | { result: "published" }
  | { result: "skipped" }
  | { result: "failed"; allowRetry?: boolean };

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  publishTool: PublishTool,
  release: PublishReleaseEntry,
  opts: PublishOptions,
  authState: AuthState,
): Promise<InternalPublishResult> {
  const publishFlags = ["--access", release.access, "--tag", release.tag];
  if (publishTool.name === "pnpm") {
    publishFlags.push("--no-git-checks");
  }

  if (process.stdin.isTTY && authState.shouldDelegate) {
    // it's not easily controllable but ideally no other work should happen until this is done
    // we specifically don't want any other output to interfere with the delegated auth flow
    const child = exec(
      publishTool.name,
      ["publish", opts.target, ...publishFlags],
      {
        nodeOptions: {
          env: opts.env,
          cwd: opts.cwd,
          stdio: ["inherit", "inherit", "pipe"],
        },
      },
    );

    const result = await child;

    if (child.exitCode === 0) {
      authState.shouldDelegate = false;
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
      authState.shouldDelegate = false;
      npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
      return { result: "skipped" };
    }

    return { result: "failed" };
  }

  // in the delegated mode we don't need the json output
  // as we won't be handling the auth errors
  publishFlags.push("--json");
  if (authState.token) {
    publishFlags.push("--otp", authState.token);
  }

  const { exitCode, stdout, stderr } = await exec(
    publishTool.name,
    ["publish", opts.target, ...publishFlags],
    {
      nodeOptions: {
        env: opts.env,
        cwd: opts.cwd,
      },
    },
  );

  if (exitCode !== 0) {
    // NPM's --json output is included alongside the `prepublish` and `postpublish` output in terminal
    // We want to handle this as best we can but it has some struggles:
    // - output of those lifecycle scripts can contain JSON
    // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
    // Note that the `--json` output is always printed at the end so this should work
    const json =
      getLastJsonObjectFromString(stderr.toString()) ||
      getLastJsonObjectFromString(stdout.toString());

    if (json?.error) {
      if (
        json.error.code === "E403" &&
        isAlreadyPublishedError(json.error.summary)
      ) {
        // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
        return { result: "skipped" };
      }
      // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
      if (
        (json.error.code === "EOTP" ||
          (json.error.code === "E401" &&
            json.error.detail?.includes("--otp=<code>"))) &&
        process.stdin.isTTY
      ) {
        // the current otp code must be invalid since it errored
        authState.token = undefined;
        authState.shouldDelegate = true;
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
An error occurred while publishing ${release.name}: ${json.error.code}
${json.error.summary}${json.error.detail ? `\n${json.error.detail}` : ""}
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
