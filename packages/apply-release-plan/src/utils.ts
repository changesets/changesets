/**
 * Shared utility functions and business logic
 */
import semverSatisfies from "semver/functions/satisfies";
import validRange from "semver/ranges/valid";
import { VersionType } from "@changesets/types";
import path from "node:path";

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
  release: {
    version: string;
    oldVersion: string;
    type: VersionType;
    dir: string;
  },
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
  }
): boolean {
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
  if (!semverSatisfies(release.version, depVersionRange)) {
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
