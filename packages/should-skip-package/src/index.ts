import { Package } from "@manypkg/get-packages";
import { PackageGroup } from "@changesets/types";
import micromatch from "micromatch";

export function shouldSkipPackage(
  { packageJson }: Package,
  {
    ignore,
    allowPrivatePackages,
  }: {
    ignore: PackageGroup;
    allowPrivatePackages: boolean;
  }
) {
  if (micromatch([packageJson.name], ignore).length > 0) {
    return true;
  }

  if (packageJson.private && !allowPrivatePackages) {
    return true;
  }

  return !packageJson.version;
}
