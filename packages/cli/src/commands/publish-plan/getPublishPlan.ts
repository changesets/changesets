import c from "@changesets/color";
import { readPreState } from "@changesets/pre";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  AccessType,
  Config,
  Package,
  PackageGroup,
  PackageJSON,
  Packages,
  PreState,
} from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { graphSequencer } from "@pnpm/deps.graph-sequencer";
import semverParse from "semver/functions/parse.js";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";
import { getCorrectRegistry, infoAllow404 } from "../publish/npm-utils.ts";

type PublishedState = "never" | "published" | "only-pre";

type BaseReleaseEntry = {
  name: string;
  version: string;
};

export type PublishReleaseEntry = BaseReleaseEntry & {
  kind: "publish";
  access: AccessType;
  registry: string;
  tag: string;
};

export type TagReleaseEntry = BaseReleaseEntry & {
  kind: "tag-only";
};

export type PublishPlan = ReadonlyArray<
  ReadonlyArray<PublishReleaseEntry | TagReleaseEntry>
>;

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
  const results = await Promise.all(
    packages.packages
      .filter(
        (pkg) => !pkg.packageJson.private && !shouldSkipPackage(pkg, options),
      )
      .map(async (pkg) => {
        const response = await infoAllow404(pkg.packageJson);
        let publishedState: PublishedState = "never";
        if (response.published) {
          publishedState = "published";
          if (
            preState != null &&
            response.pkgInfo.versions &&
            response.pkgInfo.versions.every(
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
          publishedVersions: response.pkgInfo.versions || [],
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
        registry: getCorrectRegistry(pkg.packageJson).registry,
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
  const taggablePackages = packages.filter(
    (pkg) => pkg.packageJson.private && !shouldSkipPackage(pkg, options),
  );

  return (await getUntaggedPackages(taggablePackages, cwd, tool)).map(
    ({ name, newVersion }) => ({
      kind: "tag-only",
      name,
      version: newVersion,
    }),
  );
}

function sortReleases(
  packages: Packages,
  releases: Array<ReleaseEntry>,
): PublishPlan {
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );
  const released = new Map(
    releases.map((release) => {
      const pkg = packagesByName.get(release.name);
      if (!pkg) {
        throw new Error(`Package referenced by release entry not found: ${release.name}`);
      }
      return [release.name, { pkg, release }];
    }),
  );
  const graph = new Map(
    Array.from(released.values(), ({ pkg, release }) => {
      const dependencies = new Set<string>();

      for (const dependencyType of ["dependencies", "peerDependencies"] as const) {
        const dependencyGroup = pkg.packageJson[dependencyType];
        if (!dependencyGroup) continue;

        for (const dependencyName of Object.keys(dependencyGroup)) {
          if (
            dependencyName !== pkg.packageJson.name &&
            released.has(dependencyName)
          ) {
            dependencies.add(dependencyName);
          }
        }
      }
      return [
        release,
        Array.from(
          dependencies,
          (dependencyName) => released.get(dependencyName)!.release,
        ),
      ];
    }),
  );
  const result = graphSequencer(graph);

  if (result.cycles.length > 0) {
    throw new Error(
      `Cannot compute publish plan due to cyclic dependencies: ${result.cycles
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

  return sortReleases(packages, [...releases, ...tagReleases]);
}
