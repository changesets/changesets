import semver from "semver";
import {
  NewChangeset,
  Release,
  Workspace,
  DependencyType,
  PackageJSON,
  BumpType
} from "@changesets/types";

export default async function getDependents(
  changeset: NewChangeset,
  workspaces: Workspace[],
  dependencyGraph: Map<string, string[]>,
  // We want to
  /* eslint-disable-next-line */
  globalConfig: Object
) {
  // TODO reduce changesets down to set of releases

  let releases = [...changeset.releases];
  let pkgsToSearch: Release[] = [...releases];
  let dependents: Release[] = [];

  let pkgJsonsByName = new Map(
    workspaces.map(({ name, config }) => [name, config])
  );

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    if (!nextRelease || nextRelease.type === "none") continue;
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependencyGraph.get(nextRelease.name);
    if (!pkgDependents) {
      throw new Error(
        "Error in determining dependents - could not find package"
      );
    }
    // For each dependent we are going to see whether it needs to be bumped because it's dependency
    // is leaving the version range.
    pkgDependents
      .map(dependent => {
        let type: BumpType = "none";

        const dependentPkgJSON = pkgJsonsByName.get(dependent);
        if (!dependentPkgJSON) throw new Error("Dependency map is incorrect");
        const { depTypes, versionRange } = getDependencyVersionRange(
          dependentPkgJSON,
          nextRelease.name
        );
        // Firstly we check if it is a peerDependency because if it is, our dependent bump type needs to be major.
        if (
          depTypes.includes("peerDependencies") &&
          nextRelease.type !== "patch"
        ) {
          type = "major";
        } else {
          let nextReleaseVersion =
            semver.inc(
              // @ts-ignore - I don't know how to tell ts that the
              // set of names is the same set
              pkgJsonsByName.get(nextRelease.name).version,
              // @ts-ignore - we are escaping here if nextRelease.type === 'none' waay earlier - the error case
              nextRelease.type
            ) || "";

          if (
            !dependents.some(dep => dep.name === dependent) &&
            !releases.some(dep => dep.name === dependent) &&
            !semver.satisfies(nextReleaseVersion, versionRange)
          ) {
            type = "patch";
          }
        }
        return { name: dependent, type };
      })
      .filter(({ type }) => type !== "none")
      .forEach(dependent => {
        const existing = dependents.find(dep => dep.name === dependent.name);
        // For things that are being given a major bump, we check if we have already
        // added them here. If we have, we update the existing item instead of pushing it on to search.
        // It is safe to not add it to pkgsToSearch because it should have already been searched at the
        // largest possible bump type.
        if (
          existing &&
          dependent.type === "major" &&
          existing.type !== "major"
        ) {
          existing.type = "major";
        } else {
          pkgsToSearch.push(dependent);
          dependents.push(dependent);
        }
      });
  }

  return dependents;
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
