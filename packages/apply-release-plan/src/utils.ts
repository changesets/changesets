import path from "node:path";
import type { ComprehensiveRelease, VersionType } from "@changesets/types";
/**
 * Shared utility functions and business logic
 */
import semverSatisfies from "semver/functions/satisfies.js";
import validRange from "semver/ranges/valid.js";

const bumpTypes = ["none", "patch", "minor", "major"];

/* Converts a bump type into a numeric level to indicate order */
function getBumpLevel(type: VersionType) {
  const level = bumpTypes.indexOf(type);
  if (level < 0) {
    throw new Error(`Unrecognised bump type ${type}`);
  }
  return level;
}

export function shouldUpdateDependencyBasedOnConfig(
  cwd: string,
  release: ComprehensiveRelease & { dir: string },
  {
    depVersionRange,
    depType,
  }: {
    depVersionRange: string;
    depType:
      | "dependencies"
      | "devDependencies"
      | "peerDependencies"
      | "optionalDependencies";
  },
  {
    minReleaseType,
    onlyUpdatePeerDependentsWhenOutOfRange,
  }: {
    minReleaseType: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  },
): boolean {
  if (release.newVersion == null) {
    return false;
  }
  const usesWorkspaceRange = depVersionRange.startsWith("workspace:");
  if (usesWorkspaceRange) {
    depVersionRange = depVersionRange.replace(/^workspace:/, "");
    switch (depVersionRange) {
      case "*":
        // given the old range was exact, we can short circuit and return true
        return true;
      case "^":
      case "~":
        depVersionRange = `${depVersionRange}${release.oldVersion}`;
        break;
      default: {
        if (!validRange(depVersionRange)) {
          return (
            path.posix.normalize(depVersionRange) ===
            path.relative(cwd, release.dir).replace(/\\/g, "/")
          );
        }
        // fallthrough
      }
    }
  }
  if (!semverSatisfies(release.newVersion, depVersionRange)) {
    // Dependencies leaving semver range should always be updated
    return true;
  }

  const minLevel = getBumpLevel(minReleaseType);
  let shouldUpdate = getBumpLevel(release.type) >= minLevel;

  if (depType === "peerDependencies") {
    shouldUpdate = !onlyUpdatePeerDependentsWhenOutOfRange;
  }
  return shouldUpdate;
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
