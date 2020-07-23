import { VersionType, ModCompWithPackage, Patch } from "@changesets/types";
import getVersionRangeType from "@changesets/get-version-range-type";
import { Range } from "semver";
import { shouldUpdateDependencyBasedOnConfig } from "./utils";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

/**
 * Create a list of patches for a release's `packageJSON`.
 * The returned release will contain both the patches, and a patched `packageJson`
 */
export default function versionPackage(
  release: ModCompWithPackage & { changelog?: string },
  versionsToUpdate: Array<{ name: string; version: string; type: VersionType }>,
  {
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange
  }: {
    updateInternalDependencies: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  }
): ModCompWithPackage & {
  packageJsonPatches: Patch[];
  changelog?: string;
} {
  let { newVersion, packageJson } = release;

  const packageJsonPatches = [];

  packageJson.version = newVersion;
  packageJsonPatches.push({
    path: ["version"],
    value: newVersion
  });

  for (let depType of DEPENDENCY_TYPES) {
    let deps = packageJson[depType];
    if (deps) {
      for (let { name, version, type } of versionsToUpdate) {
        let depCurrentVersion = deps[name];
        if (
          !depCurrentVersion ||
          depCurrentVersion.startsWith("file:") ||
          depCurrentVersion.startsWith("link:") ||
          !shouldUpdateDependencyBasedOnConfig(
            { version, type },
            {
              depVersionRange: depCurrentVersion,
              depType
            },
            {
              minReleaseType: updateInternalDependencies,
              onlyUpdatePeerDependentsWhenOutOfRange
            }
          )
        )
          continue;
        const usesWorkspaceRange = depCurrentVersion.startsWith("workspace:");
        if (usesWorkspaceRange) {
          depCurrentVersion = depCurrentVersion.substr(10);
        }
        if (
          // an empty string is the normalised version of x/X/*
          // we don't want to change these versions because they will match
          // any version and if someone makes the range that
          // they probably want it to stay like that
          new Range(depCurrentVersion).range !== ""
        ) {
          let rangeType = getVersionRangeType(depCurrentVersion);
          let newNewRange = `${rangeType}${version}`;
          if (usesWorkspaceRange) newNewRange = `workspace:${newNewRange}`;
          deps[name] = newNewRange;
          packageJsonPatches.push({
            path: [depType, name],
            value: newNewRange
          });
        }
      }
    }
  }

  return { ...release, packageJson, packageJsonPatches };
}
