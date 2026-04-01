import { Config } from "@changesets/types";
import { getChangedPackagesSinceRef } from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";

export async function getVersionableChangedPackages(
  config: Config,
  {
    cwd,
    ref,
  }: {
    cwd: string;
    ref?: string;
  }
) {
  const changedPackages = await getChangedPackagesSinceRef({
    ref: ref ?? config.baseBranch,
    changedFilePatterns: config.changedFilePatterns,
    cwd,
  });
  return changedPackages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
  );
}
