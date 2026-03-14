/**
 * Shared utility functions and business logic
 */
import semverSatisfies from "semver/functions/satisfies";
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

export function shouldUpdateDependencyBasedOnConfig(
  release: { version: string; type: VersionType },
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
  // Strip the workspace: protocol prefix before semver comparison.
  // workspace:^1.2.3 is a valid range once the prefix is removed; semver can't
  // parse the full "workspace:^1.2.3" string and would always treat it as out of
  // range, causing unnecessary version bumps.
  const range = depVersionRange.startsWith("workspace:")
    ? depVersionRange.slice("workspace:".length)
    : depVersionRange;

  // Implicit workspace aliases (^, ~, *) are not real semver ranges — they mean
  // "current workspace version". version-package.ts handles them with a separate
  // continue, so we skip the range check for them here.
  const isImplicitWorkspaceAlias =
    range === "^" || range === "~" || range === "*";

  if (!isImplicitWorkspaceAlias && !semverSatisfies(release.version, range)) {
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
