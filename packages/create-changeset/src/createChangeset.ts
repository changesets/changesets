import { Workspace, PackageJSON } from "get-workspaces";
import semver from "semver";
import getDependentsGraph from "./getDependentsGraph";
import { DEPENDENCY_TYPES } from "./constants";

type BumpType = "major" | "minor" | "patch";

type Options = {
  releases: Array<{ name: string; type: BumpType }>;
  packages: Array<Workspace>;
  root: Workspace;
};

/*
  Returns an object in the shape { depTypes: [], versionRange: '' } with a list of different depTypes
  matched ('dependencies', 'peerDependencies', etc) and the versionRange itself ('^1.0.0')
*/

function getDependencyVersionRange(
  dependentPkgJSON: PackageJSON,
  dependencyName: string
) {
  const dependencyVersionRange: {
    depTypes: Array<typeof DEPENDENCY_TYPES[number]>;
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

export function createChangeset({ releases, packages, root }: Options) {
  const dependencyGraph = getDependentsGraph({ packages, root });

  let pkgJsonsByName = new Map(
    packages.map(({ name, config }) => [name, config])
  );
  let getPkgJson = (pkgName: string) => {
    let pkgJson = pkgJsonsByName.get(pkgName);
    if (!pkgJson) {
      throw new Error(
        `The package.json for ${pkgName} could not be found. This is likely a bug in changesets, please open an issue.`
      );
    }
    return pkgJson;
  };
  const pkgsToSearch = [...releases];
  const dependents: Array<{
    name: string;
    type: BumpType;
  }> = [];

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    // @ts-ignore
    const nextRelease: {
      name: string;
      type: BumpType;
    } = pkgsToSearch.shift();
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependencyGraph.get(nextRelease.name);
    if (!pkgDependents) {
      throw new Error(
        `The dependents for ${
          nextRelease.name
        } could not be found. This is likely a bug in changesets, please open an issue.`
      );
    }
    // For each dependent we are going to see whether it needs to be bumped because it's dependency
    // is leaving the version range.
    pkgDependents
      .map(dependent => {
        let type = "none";

        const dependentPkgJSON = getPkgJson(dependent);

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
          let { version } = getPkgJson(nextRelease.name);
          const nextReleaseVersion = semver.inc(version, nextRelease.type);
          if (!nextReleaseVersion) {
            throw new Error(
              `There was a problem incrementing the version ${version} with bump type ${
                nextRelease.type
              }`
            );
          }
          if (
            !dependents.some(dep => dep.name === dependent) &&
            !releases.some(dep => dep.name === dependent) &&
            !semver.satisfies(nextReleaseVersion, versionRange)
          ) {
            type = "patch";
          }
        }
        return { name: dependent, type } as { name: string; type: BumpType };
      })
      // @ts-ignore
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

  // Now we need to fill in the dependencies arrays for each of the dependents. We couldn't accurately
  // do it until now because we didn't have the entire list of packages being released yet
  let finalisedDependents = dependents.map(dependent => {
    const dependentPkgJSON = getPkgJson(dependent.name);
    return {
      ...dependent,
      dependencies: [...dependents, ...releases]
        .map(pkg => pkg.name)
        .filter(
          dep => !!getDependencyVersionRange(dependentPkgJSON, dep).versionRange
        )
    };
  });

  return {
    releases,
    dependents: finalisedDependents
  };
}
