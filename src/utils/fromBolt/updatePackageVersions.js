/* eslint-disable no-continue */
// @flow
import semver from "semver";
import getDependencyGraph from "./getDependencyGraph";
import getPackageInfo from "./getPackageInfo";
// import Project from "../Project";
// import * as messages from "../utils/messages";

type VersionMap = {
  [name: string]: string
};

type Options = {
  cwd?: string
};

function versionRangeToRangeType(versionRange: string) {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  return "";
}

const getDependencyVersionRange = (config, depName: string) => {
  for (const depType of DEPENDENCY_TYPES) {
    const deps = this.config[depType];
    if (deps && deps[depName]) {
      return deps[depName];
    }
  }
  return null;
};

const getDependencyTypes = (config, depName: string): Array<string> => {
  const matchedTypes = [];
  for (const depType of DEPENDENCY_TYPES) {
    const deps = this.config[depType];
    if (deps && deps[depName]) {
      matchedTypes.push(depType);
    }
  }
  return matchedTypes;
};

/**
 * This function is used to update all the internal dependencies where you have an external source
 * bumping updated packages (a tool like bolt-releases for example).
 * It takes an object of packageNames and their new updated packages. updatePackageVersions will update all
 * internal updated packages of packages according to those new updated packages.
 * ie, a caret dep, will remain a caret dep and a pinned dep will remain pinned.
 *
 * Note: we explicitly ignore all external dependencies passed and warn if they are.
 *
 * It is up to the consumer to ensure that these new updated packages are not going to leave the repo in an
 * inconsistent state (internal deps leaving semver ranges). This can occur if your
 * updated packages will not release all packages that need to be.
 *
 */

export default async function updatePackageVersions(
  updatedPackages,
  opts = {}
) {
  const cwd = opts.cwd || process.cwd();

  const packages = getPackageInfo(cwd);
  const { graph } = await getDependencyGraph(cwd);
  const editedPackages = new Set();

  const internalDeps = Object.keys(updatedPackages).filter(dep =>
    graph.has(dep)
  );
  const externalDeps = Object.keys(updatedPackages).filter(
    dep => !graph.has(dep)
  );

  if (externalDeps.length !== 0) {
    console.warn(
      messages.externalDepsPassedToUpdatePackageVersions(externalDeps)
    );
  }

  for (const pkg of packages) {
    const name = pkg.name;

    for (const depName of internalDeps) {
      const depRange = getDependencyVersionRange(pkg.config, depName);
      const depTypes = getDependencyTypes(pkg.getConfig(), depName);
      const rangeType = versionRangeToRangeType(depRange);
      // This will update the depRange of every package being released
      const newDepRange = rangeType + updatedPackages[depName];
      if (depTypes.length === 0) continue;

      const inUpdatedPackages = internalDeps.includes(name);
      const willLeaveSemverRange = !semver.satisfies(
        updatedPackages[depName],
        depRange
      );
      // This check determines whether the package will be released. If the
      // package will not be released, we throw.
      if (!inUpdatedPackages && willLeaveSemverRange) {
        throw new Error(
          messages.invalidBoltWorkspacesFromUpdate(
            name,
            depName,
            depRange,
            updatedPackages[depName]
          )
        );
      }
      // TODO: Should this be removed, and all new releases get latest of everything
      // in the monorepo?
      // It is very unintuitive that you patch a package to update its dependency on a
      // package despite the fact that nothing in your code will indicate that will
      // happen.
      if (!inUpdatedPackages) continue;

      for (const depType of depTypes) {
        await pkg.setDependencyVersionRange(depName, depType, newDepRange);
      }
      editedPackages.add(pkg.filePath);
    }
  }

  Config.getConfig();

  return Array.from(editedPackages);
}
