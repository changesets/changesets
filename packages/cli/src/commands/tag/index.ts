import { shouldSkipPackage } from "@changesets/should-skip-package";
import { Config } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import applyGitTag from "../../utils/applyGitTag";

export default async function tag(cwd: string, config: Config) {
  const { packages, tool } = await getPackages(cwd);
  const allAreFixed = packages.length === config.fixed[0]?.length;

  const taggablePackages = packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.tag,
      })
  );

  // When all packages are fixed then force the root-style tag format.
  await applyGitTag(cwd, tool, taggablePackages, allAreFixed);
}
