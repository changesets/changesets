import c from "@changesets/color";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  Package,
  PackageGroup,
  Packages,
  PreState,
} from "@changesets/types";
import { log } from "@clack/prompts";
import semverParse from "semver/functions/parse.js";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";
import { infoAllow404 } from "./npm-utils.ts";

type PublishedState = "never" | "published" | "only-pre";

export type PackageReleaseEntry = {
  pkg: Package;
  publishedState: PublishedState;
  publishedVersions: string[];
  tag: string;
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
  tag?: string,
): Promise<Array<PackageReleaseEntry>> {
  const results: Array<Omit<PackageReleaseEntry, "tag">> = await Promise.all(
    packages
      .filter((pkg) => !pkg.packageJson.private)
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

  const packagesToPublish: Array<PackageReleaseEntry> = [];
  const previewLines: string[] = [];
  let alreadyPublishedCount = 0;

  for (const result of results) {
    const { pkg, publishedState, publishedVersions } = result;
    const localVersion = pkg.packageJson.version;

    if (!publishedVersions.includes(localVersion)) {
      const release = {
        ...result,
        tag: getReleaseTag(publishedState, preState, tag),
      };
      packagesToPublish.push(release);
      previewLines.push(
        `${c.blue(pkg.packageJson.name)}@${c.green(localVersion)}`,
      );
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
) {
  return getUntaggedPackages(
    packages.filter((pkg) => !shouldSkipPackage(pkg, options)),
    cwd,
    tool,
  );
}
