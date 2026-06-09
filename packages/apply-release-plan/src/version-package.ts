import type { ModCompWithPackage, VersionType } from "@changesets/types";
import Range from "semver/classes/range.js";
import semverPrerelease from "semver/functions/prerelease.js";
import validRange from "semver/ranges/valid.js";
import type { EditJsonOperation } from "./edit-json.ts";
import { shouldUpdateDependencyBasedOnConfig } from "./utils.ts";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type ModCompWithPackageAndChangelog = ModCompWithPackage & {
  changelog: string | null;
};

type ModCompWithPackageAndChangelogAndEdits = ModCompWithPackageAndChangelog & {
  pkgJsonEdits: EditJsonOperation[];
};

export function versionPackage(
  release: ModCompWithPackageAndChangelog,
  versionsToUpdate: Array<{
    name: string;
    version: string;
    oldVersion: string;
    type: VersionType;
    dir: string;
  }>,
  {
    cwd,
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  }: {
    cwd: string;
    updateInternalDependencies: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
    snapshot?: string | boolean | undefined;
  },
): ModCompWithPackageAndChangelogAndEdits {
  const pkgJsonEdits: EditJsonOperation[] = [];
  const { newVersion, packageJson } = release;

  pkgJsonEdits.push({ keys: ["version"], value: newVersion });

  for (const depType of DEPENDENCY_TYPES) {
    const deps = packageJson[depType];
    if (deps) {
      for (const { name, version, oldVersion, type, dir } of versionsToUpdate) {
        let depCurrentVersion = deps[name];
        if (
          !depCurrentVersion ||
          depCurrentVersion.startsWith("file:") ||
          depCurrentVersion.startsWith("link:") ||
          !shouldUpdateDependencyBasedOnConfig(
            cwd,
            { version, oldVersion, type, dir },
            {
              depVersionRange: depCurrentVersion,
              depType,
            },
            {
              minReleaseType: updateInternalDependencies,
              onlyUpdatePeerDependentsWhenOutOfRange,
            },
          )
        ) {
          continue;
        }
        const usesWorkspaceRange = depCurrentVersion.startsWith("workspace:");

        if (
          !usesWorkspaceRange &&
          (bumpVersionsWithWorkspaceProtocolOnly ||
            validRange(depCurrentVersion) == null)
        ) {
          continue;
        }

        if (usesWorkspaceRange) {
          const workspaceDepVersion = depCurrentVersion.replace(
            /^workspace:/,
            "",
          );
          if (
            workspaceDepVersion === "*" ||
            workspaceDepVersion === "^" ||
            workspaceDepVersion === "~" ||
            validRange(workspaceDepVersion) == null
          ) {
            continue;
          }
          depCurrentVersion = workspaceDepVersion;
        }
        if (
          // an empty string is the normalised version of x/X/*
          // we don't want to change these versions because they will match
          // any version and if someone makes the range that
          // they probably want it to stay like that...
          new Range(depCurrentVersion).range !== "" ||
          // ...unless the current version of a dependency is a prerelease (which doesn't satisfy x/X/*)
          // leaving those as is would leave the package in a non-installable state (wrong dep versions would get installed)
          semverPrerelease(version) != null
        ) {
          let newNewRange = snapshot
            ? version
            : `${getVersionRangeType(depCurrentVersion)}${version}`;
          if (usesWorkspaceRange) newNewRange = `workspace:${newNewRange}`;
          pkgJsonEdits.push({ keys: [depType, name], value: newNewRange });
        }
      }
    }
  }

  return { ...release, pkgJsonEdits };
}

function getVersionRangeType(
  versionRange: string,
): "^" | "~" | ">=" | "<=" | ">" | "" {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  if (versionRange.startsWith(">=")) return ">=";
  if (versionRange.startsWith("<=")) return "<=";
  if (versionRange.charAt(0) === ">") return ">";
  return "";
}
