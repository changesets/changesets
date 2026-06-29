import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import type { PackageJSON, Packages } from "@changesets/types";
import { log } from "@clack/prompts";
import { exec } from "tinyexec";
import { npmPublishQueue, npmRequestQueue } from "../../lib/common.ts";
import * as npm from "../../lib/npm.ts";
import * as pnpm from "../../lib/pnpm.ts";
import type { AuthState, InternalPublishResult } from "../../lib/types.ts";
import type { PublishReleaseEntry } from "../publish-plan/getPublishPlan.ts";

interface PublishOptions {
  /** The publish command argument, the path to the `publishConfig.directory` or tarball */
  target: string | null;
  /** The current working directory for the publish operation */
  cwd: string;
  /** The environment variables for the publish operation */
  env: NodeJS.ProcessEnv;
}

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

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
export function publish(
  publishTool: PublishTool,
  release: PublishReleaseEntry,
  opts: PublishOptions,
  authState: AuthState,
): Promise<InternalPublishResult> {
  const publish = publishTool.name === "npm" ? npm.publish : pnpm.publish;

  return npmRequestQueue.add(async () => {
    let result: InternalPublishResult;
    do {
      result = await npmPublishQueue.add(() =>
        publish({
          release,
          authState,
          cwd: opts.cwd,
          env: opts.env,
          target: opts.target,
        }),
      );
    } while (result.result === "failed" && result.allowRetry);

    return result;
  });
}
