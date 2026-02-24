import { PackageGroup, VersionType } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import semverGt from "semver/functions/gt";
import { InternalRelease } from "./types";
import { InternalError } from "@changesets/errors";

export function getHighestReleaseType(
  releases: InternalRelease[]
): VersionType {
  if (releases.length === 0) {
    throw new Error(
      `Large internal Changesets error when calculating highest release type in the set of releases. Please contact the maintainers`
    );
  }

  let highestReleaseType: VersionType = "none";

  for (let release of releases) {
    switch (release.type) {
      case "major":
        return "major";
      case "minor":
        highestReleaseType = "minor";
        break;
      case "patch":
        if (highestReleaseType === "none") {
          highestReleaseType = "patch";
        }
        break;
    }
  }

  return highestReleaseType;
}

export function getCurrentHighestVersion(
  packageGroup: PackageGroup,
  packagesByName: Map<string, Package>
): string {
  let highestVersion: string | undefined;

  for (let pkgName of packageGroup) {
    let pkg = mapGetOrThrowInternal(
      packagesByName,
      pkgName,
      `We were unable to version for package group: ${pkgName} in package group: ${packageGroup.toString()}`
    );

    if (
      highestVersion === undefined ||
      semverGt(pkg.packageJson.version, highestVersion)
    ) {
      highestVersion = pkg.packageJson.version;
    }
  }

  return highestVersion!;
}

export function mapGetOrThrow<V extends {}>(
  map: Map<string, V>,
  key: string,
  errorMessage: string
): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}

export function mapGetOrThrowInternal<V extends {}>(
  map: Map<string, V>,
  key: string,
  errorMessage: string
): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new InternalError(errorMessage);
  }
  return value;
}
