import * as git from "@changesets/git";
import { log } from "@changesets/logger";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { Config } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";

export default async function tag(cwd: string, config: Config) {
  const { packages, tool } = await getPackages(cwd);

  const allExistingTags = await git.getAllTags(cwd);

  const taggablePackages = packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.tag,
      })
  );

  for (const pkg of taggablePackages) {
    const tag =
      tool !== "root"
        ? `${pkg.packageJson.name}@${pkg.packageJson.version}`
        : `v${pkg.packageJson.version}`;

    if (allExistingTags.has(tag)) {
      log("Skipping tag (already exists): ", tag);
    } else {
      log("New tag: ", tag);
      await git.tag(tag, cwd);
    }
  }
}
