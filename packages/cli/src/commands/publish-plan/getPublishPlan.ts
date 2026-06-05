import c from "@changesets/color";
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
import semverParse from "semver/functions/parse.js";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";
import { getPublishTool, infoAllow404 } from "../publish/npm-utils.ts";

type PublishedState = "never" | "published" | "only-pre";

type BaseReleaseEntry = {
  name: string;
  version: string;
};

export type TarballMetadata = {
  path: string;
  checksum: string;
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
  const publishTool = getPublishTool(packages.tool);
  const results = await Promise.all(
    packages.packages
      .filter(
        (pkg) => !pkg.packageJson.private && !shouldSkipPackage(pkg, options),
      )
      .map(async (pkg) => {
        const response = await infoAllow404(publishTool, pkg.packageJson);
        let publishedState: PublishedState = "never";

        if (response.published) {
          publishedState = "published";

          if (preState != null) {
            if (
              response.pkgInfo.versions &&
              !response.pkgInfo.versions[
                `${semverParse(pkg.packageJson.version)!.major}.${semverParse(pkg.packageJson.version)!.minor}.${semverParse(pkg.packageJson.version)!.patch}`
              ]
            ) {
              publishedState = "only-pre";
            }
          }
        }

        return {
          pkg,
          publishedState,
        };
      }),
  );

  const packagesToPublish: Array<PublishReleaseEntry> = [];
  const previewLines: Array<string> = [];
  let alreadyPublishedCount = 0;

  for (const { pkg, publishedState } of results) {
    if (publishedState !== "published") {
      const release: PublishReleaseEntry = {
        kind: "publish",
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
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
These packages will be published as they were not found on npm:
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

  // add one nesting level in preparation for topological sorting in the future
  return [[...releases, ...tagReleases]];
}
