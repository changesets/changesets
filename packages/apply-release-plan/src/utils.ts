/**
 * Shared utility functions and business logic
 */
import semver from "semver";
import { VersionType } from "@changesets/types";

const bumpTypes = ["none", "patch", "minor", "major"];

/* Converts a bump type into a numeric level to indicate order */
function getBumpLevel(type: VersionType) {
  const level = bumpTypes.indexOf(type);
  if (level < 0) {
    throw new Error(`Unrecognised bump type ${type}`);
  }
  return level;
}

export function shouldUpdateInternalDependency(
  minReleaseType: "patch" | "minor",
  release: { version: string; type: VersionType },
  depVersionRange: string
) {
  if (!semver.satisfies(release.version, depVersionRange)) {
    // Dependencies leaving semver range should always be updated regardless of bump type
    return true;
  }

  const minLevel = getBumpLevel(minReleaseType);
  return getBumpLevel(release.type) >= minLevel;
}
