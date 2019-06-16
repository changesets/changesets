import semver from "semver";

export default async function getDependents(
  releases,
  workspaces,
  dependencyGraph,
  // We want to
  /* eslint-disable-next-line */
  config
) {
  const pkgsToSearch = [...releases];
  const dependents = [];

  let pkgJsonsByName = new Map(
    workspaces.map(({ name, config }) => [name, config])
  );

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependencyGraph.get(nextRelease.name);
    // For each dependent we are going to see whether it needs to be bumped because it's dependency
    // is leaving the version range.
    pkgDependents
      .map(dependent => {
        let type = "none";

        const dependentPkgJSON = pkgJsonsByName.get(dependent);
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
          const nextReleaseVersion = semver.inc(
            pkgJsonsByName.get(nextRelease.name).version,
            nextRelease.type
          );
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

function getDependencyVersionRange(dependentPkgJSON, dependencyName) {
  const DEPENDENCY_TYPES = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "bundledDependencies",
    "optionalDependencies"
  ];
  const dependencyVersionRange = {
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
