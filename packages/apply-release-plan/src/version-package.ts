import type { ComprehensiveRelease, PackageJSON } from "@changesets/types";
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

type VersionToUpdate = ComprehensiveRelease & { dir: string };

export type DependencyUpdateOptions = {
  cwd: string;
  updateInternalDependencies: "patch" | "minor";
  onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  snapshot?: string | boolean | undefined;
};

export function getDependencyVersionEdits(
  packageJson: PackageJSON,
  versionsToUpdate: VersionToUpdate[],
  {
    cwd,
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  }: DependencyUpdateOptions,
): EditJsonOperation[] {
  const pkgJsonEdits: EditJsonOperation[] = [];

  for (const depType of DEPENDENCY_TYPES) {
    const deps = packageJson[depType];
    if (deps) {
      for (const release of versionsToUpdate) {
        if (release.newVersion == null) {
          continue;
        }

        const { name, newVersion } = release;
        let depCurrentVersion = deps[name];
        if (
          !depCurrentVersion ||
          depCurrentVersion.startsWith("file:") ||
          depCurrentVersion.startsWith("link:") ||
          !shouldUpdateDependencyBasedOnConfig(
            cwd,
            release,
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
          semverPrerelease(newVersion) != null
        ) {
          let newNewRange = snapshot
            ? newVersion
            : `${getVersionRangeType(depCurrentVersion)}${newVersion}`;
          if (usesWorkspaceRange) newNewRange = `workspace:${newNewRange}`;
          pkgJsonEdits.push({ keys: [depType, name], value: newNewRange });
        }
      }
    }
  }

  return pkgJsonEdits;
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
