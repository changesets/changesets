import { Config } from "@changesets/types";
import { getChangedPackagesSinceRef } from "@changesets/git";
import { Package } from "@manypkg/get-packages";

function isVersionablePackage(
  { packageJson }: Package,
  {
    ignoredPackages,
    versionPrivatePackages,
  }: {
    ignoredPackages: Set<string>;
    versionPrivatePackages: boolean;
  }
) {
  if (ignoredPackages.has(packageJson.name)) {
    return false;
  }

  if (packageJson.private && !versionPrivatePackages) {
    return false;
  }

  const hasVersionField = !!packageJson.version;
  return hasVersionField;
}

export function filterVersionablePackages(config: Config, packages: Package[]) {
  const options = {
    ignoredPackages: new Set(config.ignore),
    versionPrivatePackages: config.privatePackages.version,
  };
  return packages.filter((pkg) => isVersionablePackage(pkg, options));
}

export async function getVersionableChangedPackages(
  config: Config,
  options: {
    cwd: string;
    ref?: string;
  }
) {
  const changedPackages = await getChangedPackagesSinceRef({
    ref: config.baseBranch,
    changedFilePatterns: config.changedFilePatterns,
    ...options,
  });
  return filterVersionablePackages(config, changedPackages);
}
