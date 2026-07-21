import * as git from "@changesets/git";
import type { Package, Packages } from "@changesets/types";

// TODO: deduplicate with packages/cli/src/commands/git-tag/utils.ts
export async function getUntaggedPackages(
  cwd: string,
  tool: Packages["tool"],
  packages: Package[],
) {
  if (packages.length === 0) {
    return [];
  }

  const localTags = await git.getAllTags(cwd);
  const packagesWithTags = await Promise.all(
    packages.map(async (pkg) => {
      const tagName =
        tool.type === "root"
          ? `v${pkg.packageJson.version}`
          : `${pkg.packageJson.name}@${pkg.packageJson.version}`;
      const hasTag =
        localTags.has(tagName) || (await git.remoteTagExists(tagName));

      return { pkg, hasTag };
    }),
  );

  const untagged: Array<{ name: string; newVersion: string }> = [];

  for (const packageWithTag of packagesWithTags) {
    if (!packageWithTag.hasTag) {
      untagged.push({
        name: packageWithTag.pkg.packageJson.name,
        newVersion: packageWithTag.pkg.packageJson.version,
      });
    }
  }

  return untagged;
}
