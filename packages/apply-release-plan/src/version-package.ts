import { ComprehensiveRelease, PackageJSON } from "@changesets/types";
import { getUpdatedDependencyRange } from "./utils";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export default function versionPackage(
  release: ComprehensiveRelease & {
    changelog: string | null;
    packageJson: PackageJSON;
    dir: string;
  },
  versionsToUpdate: ComprehensiveRelease[],
  {
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  }: {
    updateInternalDependencies: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
    snapshot?: string | boolean | undefined;
  }
) {
  let { newVersion, packageJson } = release;

  packageJson.version = newVersion;

  for (let depType of DEPENDENCY_TYPES) {
    let deps = packageJson[depType];
    if (!deps) {
      continue;
    }
    for (let dependencyRelease of versionsToUpdate) {
      let depCurrentVersion = deps[dependencyRelease.name];

      if (!depCurrentVersion) {
        continue;
      }

      const { range } = getUpdatedDependencyRange(
        dependencyRelease,
        {
          depVersionRange: depCurrentVersion,
          depType,
        },
        {
          minReleaseType: updateInternalDependencies,
          onlyUpdatePeerDependentsWhenOutOfRange,
          bumpVersionsWithWorkspaceProtocolOnly,
          snapshot,
        }
      );
      deps[dependencyRelease.name] = range;
    }
  }

  return { ...release, packageJson };
}
