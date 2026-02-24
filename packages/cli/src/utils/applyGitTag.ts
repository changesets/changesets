import * as git from "@changesets/git";
import { error, log } from "@changesets/logger";
import { PackageJSON } from "@changesets/types";
import { PublishedResult } from "../commands/publish/publishPackages";
import { Package, Tool } from "@manypkg/get-packages";
import { getUntaggedPackages } from "./getUntaggedPackages";

export default async function applyGitTag(
  cwd: string,
  tool: Tool,
  packages: (Omit<PublishedResult, "published"> | Package)[],
  /**
   * When true, will force tagging to use root-style tags (vX.X.X).
   */
  forceRootTag = false
) {
  if (packages.length === 0) {
    error("No packages to tag");
    return;
  }

  const normalizedPackages = normalizePackages(packages);
  const allExistingTags = await git.getAllTags(cwd);

  if (forceRootTag) {
    await gitTag(cwd, `v${normalizedPackages[0].version}`, allExistingTags);
    return;
  }

  for (const { name, newVersion } of await getUntaggedPackages(
    normalizedPackages,
    cwd,
    tool
  )) {
    const tagName =
      tool === "root" ? `v${newVersion}` : `${name}@${newVersion}`;

    await gitTag(cwd, tagName, allExistingTags);
  }
}

async function gitTag(
  cwd: string,
  tagName: string,
  allExistingTags: Set<string>
) {
  if (allExistingTags.has(tagName)) {
    log("Skipping tag (already exists): ", tagName);
    return;
  }

  log("New tag: ", tagName);
  await git.tag(tagName, cwd);
}

function normalizePackages(
  packages: (Omit<PublishedResult, "published"> | Package)[]
): PackageJSON[] {
  return packages.map((pkg) => {
    if ("packageJson" in pkg) {
      return pkg.packageJson;
    }
    return {
      name: pkg.name,
      version: pkg.newVersion,
    };
  });
}
