import * as git from "@changesets/git";
import type { Package, Packages } from "@changesets/types";

export async function getUntaggedPackages(
  packages: Package[],
  cwd: string,
  tool: Packages["tool"],
) {
  const packageWithTags = await Promise.all(
    packages.map(async (pkg) => {
      const tagName =
        tool.type === "root"
          ? `v${pkg.packageJson.version}`
          : `${pkg.packageJson.name}@${pkg.packageJson.version}`;
      const hasTag =
        (await git.tagExists(tagName, cwd)) ||
        (await git.remoteTagExists(tagName));

      return { pkg, hasTag };
    }),
  );

  const untagged: Array<{ name: string; newVersion: string }> = [];

  for (const packageWithTag of packageWithTags) {
    if (!packageWithTag.hasTag) {
      untagged.push({
        name: packageWithTag.pkg.packageJson.name,
        newVersion: packageWithTag.pkg.packageJson.version,
      });
    }
  }

  return untagged;
}
