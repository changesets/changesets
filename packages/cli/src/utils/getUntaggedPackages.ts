import * as git from "@changesets/git";
import { PackageJSON } from "@changesets/types";
import { Package, Tool } from "@manypkg/get-packages";
import { PublishedResult } from "../commands/publish/publishPackages";

export async function getUntaggedPackages(
  packages: (PackageJSON | Package)[],
  cwd: string,
  tool: Tool
) {
  const normalizedPackages = packages.map((pkg) =>
    "packageJson" in pkg ? pkg.packageJson : pkg
  );

  const packageWithTags = await Promise.all(
    normalizedPackages.map(async (pkg) => {
      const tagName =
        tool === "root" ? `v${pkg.version}` : `${pkg.name}@${pkg.version}`;
      const isMissingTag = !(
        (await git.tagExists(tagName, cwd)) ||
        (await git.remoteTagExists(tagName))
      );

      return { pkg, isMissingTag };
    })
  );

  const untagged: PublishedResult[] = [];

  for (const packageWithTag of packageWithTags) {
    if (packageWithTag.isMissingTag) {
      untagged.push({
        name: packageWithTag.pkg.name,
        newVersion: packageWithTag.pkg.version,
        published: false,
      });
    }
  }

  return untagged;
}
