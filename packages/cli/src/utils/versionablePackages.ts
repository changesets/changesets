import { Config } from "@changesets/types";
import { getChangedPackagesSinceRef } from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";

type ChangedPackageOptions = {
  cwd: string;
  ref?: string;
  enablePnpmCatalog?: boolean;
};

export async function getVersionableChangedPackages(
  config: Config,
  options: ChangedPackageOptions
) {
  const { cwd, ref, enablePnpmCatalog } = options;
  const changedPackages = await getChangedPackagesSinceRef({
    ref: ref ?? config.baseBranch,
    changedFilePatterns: config.changedFilePatterns,
    cwd,
    includeCatalogUpdates: enablePnpmCatalog ?? false,
  });
  return changedPackages.filter((pkg) => {
    return !shouldSkipPackage(pkg, {
      ignore: config.ignore,
      allowPrivatePackages: config.privatePackages.version,
    });
  });
}
