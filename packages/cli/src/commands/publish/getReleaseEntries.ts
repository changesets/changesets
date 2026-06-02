import c from "@changesets/color";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  AccessType,
  Package,
  PackageGroup,
  Packages,
  PreState,
} from "@changesets/types";
import { log } from "@clack/prompts";
import semverParse from "semver/functions/parse.js";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";
import { getCorrectRegistry, infoAllow404 } from "./npm-utils.ts";

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
  packages: Array<Package>,
  preState: PreState | undefined,
  access: AccessType,
  options: { tag?: string; ignore: PackageGroup; allowPrivatePackages: boolean },
): Promise<Array<PublishReleaseEntry>> {
  const results = await Promise.all(
    packages
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
  const previewLines: string[] = [];
  let alreadyPublishedCount = 0;

  for (const result of results) {
    const { pkg, publishedState, publishedVersions } = result;
    const localVersion = pkg.packageJson.version;

    if (!publishedVersions.includes(localVersion)) {
      const release = {
        kind: "publish" as const,
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
