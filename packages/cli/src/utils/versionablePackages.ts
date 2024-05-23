import { Config } from "@changesets/types";
import { getChangedPackagesSinceRef } from "@changesets/git";
import { Package } from "@manypkg/get-packages";

// Note: if updating this, also update the other copies of createIsVersionablePackage.
export function createIsVersionablePackage(
  ignoredPackages: readonly string[],
  allowPrivatePackages: boolean
): (pkg: Package) => boolean {
  const ignoredPackagesSet = new Set(ignoredPackages);
  return ({ packageJson }: Package) => {
    if (ignoredPackagesSet.has(packageJson.name)) {
      return false;
    }

    if (packageJson.private && !allowPrivatePackages) {
      return false;
    }

    const hasVersionField = !!packageJson.version;
    return hasVersionField;
  };
}

export function filterVersionablePackages(config: Config, packages: Package[]) {
  const isVersionablePackage = createIsVersionablePackage(
    config.ignore,
    config.privatePackages.version
  );
  return packages.filter((pkg) => isVersionablePackage(pkg));
}

export function filterTaggablePackages(config: Config, packages: Package[]) {
  const isVersionablePackage = createIsVersionablePackage(
    config.ignore,
    config.privatePackages.tag
  );
  return packages.filter((pkg) => isVersionablePackage(pkg));
}

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
  return filterVersionablePackages(config, changedPackages);
}
