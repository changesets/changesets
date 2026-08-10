import fs from "node:fs/promises";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { readPreState } from "@changesets/pre";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  AccessType,
  Config,
  Package,
  PackageGroup,
  Packages,
  PreState,
} from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { graphSequencer } from "@pnpm/deps.graph-sequencer";
import semverParse from "semver/functions/parse.js";
import { npmRequestQueue } from "../../lib/common.ts";
import { splitByTagStatus } from "../../utils/gitTags.ts";
import { getPublishTool } from "../publish/getPublishTool.ts";

export const CURRENT_PUBLISH_PLAN_VERSION = 1;

type PublishedState = "never" | "published" | "only-pre";

type BaseReleaseEntry = {
  name: string;
  version: string;
};

export type TarballMetadata = {
  path: string;
  integrity: string;
};

// NOTE: publish plan gets computed based on the registry configuration coming from publishConfig, config and env values.
// To compute what gets included in the publish plan, we need to query the registry.
// However, we don't quite know what exactly got queried at the end as that gets largely delegated to the package manager CLIs and their internal logic.
// Given we don't want to reimplement everything carefully for each package manager, we can't include the registry in the publish plan's release entries.
// So, to some extent, the overall flow relies on matching configuration values between publish-plan and publish invocations.
//
// This also assumes "core" fields (like name and version) match between ./packages/pkg-a/package.json and ./packages/pkg-a/dist/package.json when using `publishConfig.directory`.
// It's hard to imagine a legitimate/non-contrived examples for this not being the case.
export type PublishReleaseEntry = BaseReleaseEntry & {
  kind: "publish";
  access: AccessType;
  tag: string;
  tarball?: TarballMetadata;
};

export type TagReleaseEntry = BaseReleaseEntry & {
  kind: "tag-only";
};

export type PublishPlan = ReadonlyArray<
  ReadonlyArray<PublishReleaseEntry | TagReleaseEntry>
>;

export async function readPlanFile(filePath: string): Promise<PublishPlan> {
  const json = JSON.parse(await fs.readFile(filePath, "utf8"));

  if (!json || typeof json !== "object") {
    throw new Error("Invalid publish plan file");
  }

  if (!Array.isArray(json.plan)) {
    throw new Error("Invalid publish plan file");
  }

  if (json.version !== CURRENT_PUBLISH_PLAN_VERSION) {
    throw new Error(
      `Invalid publish plan file version: expected ${CURRENT_PUBLISH_PLAN_VERSION}, received ${String(json.version)}`,
    );
  }

  return json.plan;
}

type ReleaseEntry = PublishReleaseEntry | TagReleaseEntry;

function getReleaseTag(
  publishedState: PublishedState,
  preState?: PreState,
  tag?: string,
) {
  if (tag) return tag;

  if (preState != null && publishedState !== "only-pre") {
    return preState.tag;
  }

  return "latest";
}

export async function getUnpublishedPackages(
  packages: Packages,
  preState: PreState | undefined,
  access: AccessType,
  options: {
    tag?: string;
    ignore: PackageGroup;
    allowPrivatePackages: boolean;
  },
): Promise<Array<PublishReleaseEntry>> {
  const publishTool = await getPublishTool(packages);
  const results = await Promise.all(
    packages.packages
      .filter(
        (pkg) => !pkg.packageJson.private && !shouldSkipPackage(pkg, options),
      )
      .map(async (pkg) => {
        const response = await npmRequestQueue.add(() =>
          publishTool.info({
            cwd: packages.rootDir,
            pkg,
          }),
        );
        if ("error" in response) {
          log.error(
            `
Received an unexpected error for ${c.cyan(pkg.packageJson.name)}: ${response.error.code || "(no code)"}
${response.error.message || "Unknown error"}
            `.trim(),
          );
          throw new ExitError(1);
        }
        if (!response.published) {
          log.warn(
            `Package ${c.cyan(pkg.packageJson.name)} was not found in the registry.`,
          );
        }

        let publishedState: PublishedState = "never";
        let publishedVersions: string[] = [];

        if (response.published) {
          publishedState = "published";
          publishedVersions = response.info.versions;

          if (
            preState != null &&
            // non-npm registries often don't auto-assign latest and when using those we don't have to care about only-pre case
            // when the latest tag is not auto-assigned we can simply use the configured pre tag
            response.info["dist-tags"].latest &&
            response.info.versions.every(
              (version: string) =>
                semverParse(version)!.prerelease[0] === preState.tag,
            )
          ) {
            publishedState = "only-pre";
          }
        }

        return {
          pkg,
          publishedState,
          publishedVersions,
        };
      }),
  );

  const packagesToPublish: Array<PublishReleaseEntry> = [];
  const previewLines: Array<string> = [];
  let alreadyPublishedCount = 0;

  for (const result of results) {
    const { pkg, publishedState, publishedVersions } = result;
    const localVersion = pkg.packageJson.version;

    if (!publishedVersions.includes(localVersion)) {
      const release: PublishReleaseEntry = {
        kind: "publish",
        name: pkg.packageJson.name,
        version: localVersion,
        access: pkg.packageJson.publishConfig?.access || access,
        tag: getReleaseTag(publishedState, preState, options.tag),
      };
      packagesToPublish.push(release);
      previewLines.push(`${c.blue(release.name)}@${c.green(release.version)}`);
      if (preState != null && publishedState === "only-pre") {
        previewLines.push(
          `${c.gray("└")} will be published to ${c.cyan("latest")} rather than ${c.cyan(preState.tag)} as it will be its first published version.`,
        );
      }
    } else {
      alreadyPublishedCount++;
    }
  }

  if (packagesToPublish.length !== 0) {
    log.info(
      `
These packages will be published as they were not found in the registry:
${previewLines.join("\n")}
${c.gray(`${alreadyPublishedCount} packages are already published.`)}
      `.trim(),
    );
  }

  return packagesToPublish;
}

export async function getUntaggedPrivatePackages(
  cwd: string,
  packages: Array<Package>,
  tool: Packages["tool"],
  options: { ignore: PackageGroup; allowPrivatePackages: boolean },
): Promise<Array<TagReleaseEntry>> {
  const taggableReleases = packages
    .filter(
      (pkg) => pkg.packageJson.private && !shouldSkipPackage(pkg, options),
    )
    .map(
      (pkg): TagReleaseEntry => ({
        kind: "tag-only",
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
      }),
    );

  return (await splitByTagStatus(cwd, tool, taggableReleases)).untagged;
}

function sortReleases(
  packages: Packages,
  releases: Array<ReleaseEntry>,
  opts: {
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  },
): PublishPlan {
  const dependentsGraph = getDependentsGraph(packages, {
    bumpVersionsWithWorkspaceProtocolOnly:
      opts.bumpVersionsWithWorkspaceProtocolOnly,
    ignoreDevDependencies: true,
  });
  const releasesByName = new Map(
    releases.map((release) => {
      // validate externally-provided releases
      if (!dependentsGraph.has(release.name)) {
        throw new Error(
          `Package referenced by release entry not found: ${release.name}`,
        );
      }
      return [release.name, release];
    }),
  );
  const graph = new Map<ReleaseEntry, ReleaseEntry[]>(
    releases.map((release) => [release, []]),
  );

  for (const [dependencyName, dependents] of dependentsGraph) {
    const release = releasesByName.get(dependencyName);
    if (!release) continue;

    for (const dependentName of dependents) {
      const dependentRelease = releasesByName.get(dependentName);
      if (!dependentRelease) continue;
      graph.get(dependentRelease)!.push(release);
    }
  }
  const result = graphSequencer(graph);

  if (result.cycles.length > 0) {
    log.warn(
      `Publish plan contains cyclic dependencies: ${result.cycles
        .map((cycle) => cycle.map((release) => release.name).join(" -> "))
        .join("; ")}`,
    );
  }

  return result.chunks;
}

export async function getPublishPlan(
  rootDir: string,
  config: Config,
  options?: { tag?: string },
): Promise<PublishPlan> {
  const packages = await getPackages(rootDir);
  const preState = await readPreState(rootDir);

  const releases = await getUnpublishedPackages(
    packages,
    preState,
    config.access,
    {
      tag: options?.tag,
      ignore: config.ignore,
      allowPrivatePackages: config.privatePackages.tag,
    },
  );
  const tagReleases = config.privatePackages.tag
    ? await getUntaggedPrivatePackages(
        packages.rootDir,
        packages.packages,
        packages.tool,
        {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.tag,
        },
      )
    : [];

  if (releases.length === 0 && tagReleases.length === 0) {
    return [];
  }

  return sortReleases(packages, [...releases, ...tagReleases], config);
}
