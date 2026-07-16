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
import * as yarn from "../../lib/yarn.ts";
import {
  getPackageManagerError,
  isJsonObject,
} from "../../utils/package-manager-errors.ts";
import { streamNdjson } from "../../utils/streamNdjson.ts";

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

async function getYarnVersion(packages: Packages) {
  const { stdout } = await exec("yarn", ["--version"], {
    nodePath: false,
    nodeOptions: {
      cwd: packages.rootDir,
    },
  });
  const major = Number(stdout.toString().trim().split(".")[0]);
  return Number.isNaN(major) || major >= 2 ? "berry" : "classic";
}

export async function getPublishTool(packages: Packages): Promise<PublishTool> {
  // removed in build process
  if (process.env.CHANGESETS_FAKE_PUBLISH != null) {
    return mock;
  }
  if (packages.tool.type === "pnpm") {
    return pnpm;
  }
  if (packages.tool.type === "yarn") {
    if ((await getYarnVersion(packages)) === "classic") {
      throw new Error(
        "Yarn Classic is not supported. Please upgrade to Yarn Berry or another maintained package manager.",
      );
    }
    return yarn;
  }
  return npm;
}

function parseInfoOutput(publishTool: PublishTool, output: string) {
  if (publishTool.name === "yarn") {
    let info: unknown;
    for (const entry of streamNdjson(output)) {
      info = entry;
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
  if (publishTool.name === "mock") {
    return ["npm", "info"];
  }
  return publishTool.name === "yarn"
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

    // Yarn doesn't support `yarn npm info --registry` even though it does support `publishConfig.registry` as a publish-time override.
    // But it also supports separate `npmRegistryServer` and `npmPublishRegistry` for the same scope.
    // So it seems that in their model we should be using the *fetch* registry for info queries *anyway*.
    //
    // In pnpm `publishConfig.registry` is the only supported registry value and it's a strong publish-time override.
    // However, pnpm's recursive publish doesn't use that to query which packages are already published:
    // https://github.com/pnpm/pnpm/blob/b4fdfe9b3381bde2b09c1aa8af9f31446b177c83/pnpm11/releasing/commands/src/publish/recursivePublish.ts#L85-L94
    //
    // We match that behavior and in pnpm we treat `publishConfig.registry` as a publish-time override only.
    if (publishTool.name !== "pnpm" && publishTool.name !== "mock") {
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
        nodePath: false,
        nodeOptions: { cwd },
      },
    );

    const bareInfo = parseInfoResult(publishTool, result);
    // It's worth noting that Yarn Berry always returns nice `bareInfo` output, even if the package doesn't have a `latest` dist-tag.
    // And it does return a `fallbackVersion` even when requesting an exact version that doesn't yet exist:
    // https://github.com/yarnpkg/berry/blob/0a230c14e71247576f6b51fa811ae08edb6608aa/packages/plugin-npm-cli/sources/commands/npm/info.ts#L124
    //
    // The second bit isn't particularly important for us though as we don't have to request `exactInfo` in its case anyway.
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
      { nodePath: false, nodeOptions: { cwd } },
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
    // Yarn: failed info requests are reporter errors. Missing packages
    // use YN0035 with the registry response code included in the joined data.
    (publishTool.name === "yarn" &&
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
