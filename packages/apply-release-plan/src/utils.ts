/**
 * Shared utility functions and business logic
 */
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

export function shouldUpdateInternalDependencies(
  minReleaseType: "patch" | "minor",
  releaseType: VersionType
) {
  const minLevel = getBumpLevel(minReleaseType);
  return getBumpLevel(releaseType) >= minLevel;
}
