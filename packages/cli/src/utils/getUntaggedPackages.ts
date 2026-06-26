import * as git from "@changesets/git";
import type { Package, Packages } from "@changesets/types";

export async function getUntaggedPackages(
  packages: Array<Package>,
  cwd: string,
  tool: Packages["tool"],
) {
  const packageWithTags = await Promise.all(
    packages.map(async (pkg) => {
      const tagName =
        tool.type === "root"
          ? `v${pkg.packageJson.version}`
          : `${pkg.packageJson.name}@${pkg.packageJson.version}`;
      const isMissingTag = !(
        (await git.tagExists(tagName, cwd)) ||
        (await git.remoteTagExists(tagName))
      );

      return { pkg, isMissingTag };
    }),
  );

  const untagged: Array<{ name: string; newVersion: string }> = [];

  for (const packageWithTag of packageWithTags) {
    if (packageWithTag.isMissingTag) {
      untagged.push({
        name: packageWithTag.pkg.packageJson.name,
        newVersion: packageWithTag.pkg.packageJson.version,
      });
    }
  }

  return untagged;
}
