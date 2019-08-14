import semver from "semver";
import {
  Release,
  Workspace,
  DependencyType,
  PackageJSON,
  VersionType
} from "@changesets/types";
import { InternalRelease } from "./types";

/*
  WARNING:
  Important note for understanding how this package works:

  We are doing some kind of wacky things with manipulating the objects within the
  releases array, despite the fact that this was passed to us as an argument. We are
  aware that this is generally bad practice, but have decided to to this here as
  we control the entire flow of releases.

  We could solve this by inlining this function, or by returning a deep-cloned then
  modified array, but we decided both of those are worse than this solution.
*/
export default function getDependents(
  releases: InternalRelease[],
  workspaces: Workspace[],
  dependencyGraph: Map<string, string[]>
): boolean {
  let updated = false;
  // NOTE this is intended to be called recursively
  let pkgsToSearch = [...releases];

  let pkgJsonsByName = new Map(
    // TODO this seems an inefficient use of getting the whole workspaces
    // Should we ask for this to be simplified 'above'?
    workspaces.map(({ name, config }) => [name, config])
  );

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    if (!nextRelease) continue;
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependencyGraph.get(nextRelease.name);
    if (!pkgDependents) {
      throw new Error(
        `Error in determining dependents - could not find package in repository: ${
          nextRelease.name
        }`
      );
    }
    // For each dependent we are going to see whether it needs to be bumped because it's dependency
    // is leaving the version range.
    pkgDependents
      .map(dependent => {
        let type: VersionType | undefined;

        const dependentPkgJSON = pkgJsonsByName.get(dependent);
        if (!dependentPkgJSON) throw new Error("Dependency map is incorrect");
        const { depTypes, versionRange } = getDependencyVersionRange(
          dependentPkgJSON,
          nextRelease.name
        );

        // Firstly we check if it is a peerDependency because if it is, our dependent bump type needs to be major.
        if (
          depTypes.includes("peerDependencies") &&
          nextRelease.type !== "patch" &&
          (!releases.some(dep => dep.name === dependent) ||
            releases.some(
              dep => dep.name === dependent && dep.type !== "major"
            ))
        ) {
          type = "major";
        } else {
          if (
            // TODO validate this - I don't think it's right anymore
            !releases.some(dep => dep.name === dependent) &&
            !semver.satisfies(
              semver.inc(nextRelease.oldVersion, nextRelease.type)!,
              versionRange
            )
          ) {
            type = "patch";
          }
        }
        return { name: dependent, type, pkgJSON: dependentPkgJSON };
      })
      .filter(({ type }) => type)
      .forEach(
        // @ts-ignore - I don't know how to make typescript understand that the filter above guarantees this and I got sick of trying
        ({ name, type, pkgJSON }: Release & { pkgJSON: PackageJSON }) => {
          // At this point, we know if we are making a change
          updated = true;

          const existing = releases.find(dep => dep.name === name);
          // For things that are being given a major bump, we check if we have already
          // added them here. If we have, we update the existing item instead of pushing it on to search.
          // It is safe to not add it to pkgsToSearch because it should have already been searched at the
          // largest possible bump type.

          if (existing && type === "major" && existing.type !== "major") {
            existing.type = "major";

            pkgsToSearch.push(existing);
          } else {
            let newDependent: InternalRelease = {
              name,
              type,
              oldVersion: pkgJSON.version,
              changesets: []
            };

            pkgsToSearch.push(newDependent);
            releases.push(newDependent);
          }
        }
      );
  }

  return updated;
}

/*
  Returns an object in the shape { depTypes: [], versionRange: '' } with a list of different depTypes
  matched ('dependencies', 'peerDependencies', etc) and the versionRange itself ('^1.0.0')
*/

function getDependencyVersionRange(
  dependentPkgJSON: PackageJSON,
  dependencyName: string
) {
  const DEPENDENCY_TYPES = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ] as const;
  const dependencyVersionRange: {
    depTypes: DependencyType[];
    versionRange: string;
  } = {
    depTypes: [],
    versionRange: ""
  };
  for (const type of DEPENDENCY_TYPES) {
    const deps = dependentPkgJSON[type];
    if (!deps) continue;
    if (deps[dependencyName]) {
      dependencyVersionRange.depTypes.push(type);
      // We'll just override this each time, *hypothetically* it *should* be the same...
      dependencyVersionRange.versionRange = deps[dependencyName];
    }
  }
  return dependencyVersionRange;
}
