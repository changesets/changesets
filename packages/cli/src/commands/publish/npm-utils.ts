import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import type { PackageJSON, Packages } from "@changesets/types";
import { log } from "@clack/prompts";
import { exec } from "tinyexec";
import { npmRequestQueue } from "../../lib/common.ts";
import * as mock from "../../lib/mock.ts";
import * as npm from "../../lib/npm.ts";
import * as pnpm from "../../lib/pnpm.ts";
import type { PublishTool } from "../../lib/types.ts";

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

export function getPublishTool({ type }: Packages["tool"]): PublishTool {
  // removed in build process
  if (process.env.CHANGESETS_FAKE_PUBLISH != null) {
    return mock;
  }

  if (type === "pnpm") return pnpm;

  return npm;
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
    if (publishTool.name !== "pnpm" && publishTool.name !== "mock") {
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
    let result = await exec(
      publishTool.name !== "mock" ? publishTool.name : "npm",
      ["info", packageJson.name, ...registryOverrides, "--json"],
    );

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
