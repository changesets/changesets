import {
  ComprehensiveRelease,
  PackageJSON,
  VersionType
} from "@changesets/types";
import getVersionRangeType from "@changesets/get-version-range-type";
import { Range } from "semver";
import { shouldUpdateInternalDependencies } from "./utils";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

export default function versionPackage(
  release: ComprehensiveRelease & {
    changelog: string | null;
    packageJson: PackageJSON;
    dir: string;
  },
  versionsToUpdate: Array<{ name: string; version: string; type: VersionType }>,
  updateInternalDependencies: "patch" | "minor"
) {
  let { newVersion, packageJson } = release;

  packageJson.version = newVersion;

  for (let type of DEPENDENCY_TYPES) {
    let deps = packageJson[type];
    if (deps) {
      for (let { name, version, type } of versionsToUpdate) {
        let depCurrentVersion = deps[name];
        if (
          !depCurrentVersion ||
          depCurrentVersion.startsWith("file:") ||
          depCurrentVersion.startsWith("link:") ||
          !shouldUpdateInternalDependencies(updateInternalDependencies, type)
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
        }
      }
    }
  }

  return { ...release, packageJson };
}
