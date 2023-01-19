import { Config, SingleChangelogPackageGroup } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import { InternalRelease } from "./types";
import { getCurrentHighestVersion, getHighestReleaseType } from "./utils";

export default function matchFixedConstraint(
  releases: Map<string, InternalRelease>,
  packagesByName: Map<string, Package>,
  config: Config
): boolean {
  let updated = false;

  for (let fixedPackages of config.fixed) {
    const packageGroup = isSingleChangelogFixedPackageGroup(fixedPackages)
      ? fixedPackages.group
      : fixedPackages;
    let releasingFixedPackages = [...releases.values()].filter(
      (release) =>
        packageGroup.includes(release.name) && release.type !== "none"
    );

    if (releasingFixedPackages.length === 0) continue;

    let highestReleaseType = getHighestReleaseType(releasingFixedPackages);
    let highestVersion = getCurrentHighestVersion(packageGroup, packagesByName);

    // Finally, we update the packages so all of them are on the highest version
    for (let pkgName of packageGroup) {
      if (config.ignore.includes(pkgName)) {
        continue;
      }
      let release = releases.get(pkgName);

      if (!release) {
        updated = true;
        releases.set(pkgName, {
          name: pkgName,
          type: highestReleaseType,
          oldVersion: highestVersion,
          changesets: [],
        });
        continue;
      }

      if (release.type !== highestReleaseType) {
        updated = true;
        release.type = highestReleaseType;
      }
      if (release.oldVersion !== highestVersion) {
        updated = true;
        release.oldVersion = highestVersion;
      }
    }
  }

  return updated;
}

export const isSingleChangelogFixedPackageGroup = (
  pkgGroup: unknown
): pkgGroup is SingleChangelogPackageGroup => {
  return Boolean(
    pkgGroup &&
      Array.isArray((pkgGroup as SingleChangelogPackageGroup).group) &&
      ((pkgGroup as SingleChangelogPackageGroup).group as unknown[]).every(
        (pkgName) => typeof pkgName === "string"
      ) &&
      typeof (pkgGroup as SingleChangelogPackageGroup).changelog === "string"
  );
};
