import type { PackageGroup, ChangesetsPackage } from "@changesets/types";

export function shouldSkipPackage(
  { packageJson }: ChangesetsPackage,
  {
    ignore,
    allowPrivatePackages,
  }: {
    ignore: PackageGroup;
    allowPrivatePackages: boolean;
  },
) {
  if (ignore.includes(packageJson.name)) {
    return true;
  }

  if (packageJson.private && !allowPrivatePackages) {
    return true;
  }

  return !packageJson.version;
}
