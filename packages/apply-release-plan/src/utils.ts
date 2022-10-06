/**
 * Shared utility functions and business logic
 */
import getVersionRangeType from "@changesets/get-version-range-type";
import { VersionType, ComprehensiveRelease } from "@changesets/types";
import semver from "semver";

const bumpTypes = ["none", "patch", "minor", "major"];

/* Converts a bump type into a numeric level to indicate order */
function getBumpLevel(type: VersionType) {
  const level = bumpTypes.indexOf(type);
  if (level === -1) {
    throw new Error(`Unrecognised bump type ${type}`);
  }
  return level;
}

export function getUpdatedDependencyRange(
  dependencyRelease: ComprehensiveRelease,
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
    bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  }: {
    minReleaseType: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
    snapshot?: string | boolean | undefined;
  }
): { range: string; satisfied: boolean } {
  if (/^(file|link):/.test(depVersionRange)) {
    return {
      range: depVersionRange,
      satisfied: true,
    };
  }

  const workspaceRange = depVersionRange.startsWith("workspace:")
    ? depVersionRange.replace(/^workspace:/, "")
    : null;

  if (bumpVersionsWithWorkspaceProtocolOnly && !workspaceRange) {
    return {
      range: depVersionRange,
      satisfied: true,
    };
  }

  if (workspaceRange === "*" || workspaceRange?.includes("/")) {
    return {
      range: depVersionRange,
      // those workspace ranges are equivalent to a fixed version without any range modifiers etc
      // so if a dependency gets a new release then we can be sure that it doesn't satisfy those ranges
      satisfied: false,
    };
  }

  if (workspaceRange === "^" || workspaceRange === "~") {
    return {
      range: depVersionRange,
      satisfied: semver.satisfies(
        dependencyRelease.newVersion,
        `${workspaceRange}${dependencyRelease.oldVersion}`
      ),
    };
  }

  // TODO: should this be moved as a higher-priority check?
  if (snapshot) {
    return {
      range: workspaceRange
        ? `workspace:${dependencyRelease.newVersion}`
        : dependencyRelease.newVersion,
      satisfied: false,
    };
  }

  const currentRange = workspaceRange || depVersionRange;

  // dependencies staying in the semver range can always be left intact, other ones have to be always updated
  if (semver.satisfies(dependencyRelease.newVersion, currentRange)) {
    if (
      depType === "peerDependencies" &&
      onlyUpdatePeerDependentsWhenOutOfRange
    ) {
      return {
        range: depVersionRange,
        satisfied: true,
      };
    }
    // an empty string is the normalised version of x/X/*
    // we don't want to change these versions because they will match
    // any version and if someone makes the range that
    // they probably want it to stay like that...
    if (new semver.Range(currentRange).range === "") {
      return {
        range: workspaceRange ? `workspace:${currentRange}` : currentRange,
        satisfied: true,
      };
    }
    return {
      range: `${workspaceRange ? "workspace:" : ""}${
        getBumpLevel(dependencyRelease.type) >= getBumpLevel(minReleaseType)
          ? `${getVersionRangeType(currentRange)}${
              dependencyRelease.newVersion
            }`
          : depVersionRange
      }`,
      satisfied: true,
    };
  }

  // from now on we know that the new version doesn't satisfy the defined range
  // this includes ranges like x/X/* when the new version is a prerelease
  // we can't leave those as is as it would leave the package in a non-installable state (wrong dep versions would get installed)

  return {
    range: `${workspaceRange ? `workspace:` : ""}${getVersionRangeType(
      currentRange
    )}${dependencyRelease.newVersion}`,
    satisfied: false,
  };
}
