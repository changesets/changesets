import { Config } from "@changesets/types";
import { getChangedPackagesSinceRef, getStagedPackages } from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";

export async function getVersionableStagedPackages(
  config: Config,
  {
    cwd,
  }: {
    cwd: string;
    ref?: string;
  }
) {
  const stagedPackages = await getStagedPackages({
    changedFilePatterns: config.changedFilePatterns,
    cwd,
  });
  return stagedPackages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
  );
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
  return changedPackages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
  );
}
