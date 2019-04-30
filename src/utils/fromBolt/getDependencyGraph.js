// This is a modified version of the graph-getting in bolt

/* eslint-disable prefer-destructuring */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import fs from "fs-extra";
import path from "path";
import semver from "semver";

import getPackageInfo from "./getPackageInfo";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "bundledDependencies",
  "optionalDependencies"
];

const getAllDependencies = () => {
  const allDependencies = new Map();

  for (const type of DEPENDENCY_TYPES) {
    const deps = this.config[type];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      allDependencies.set(name, deps[name]);
    }
  }

  return allDependencies;
};

export default async function getDependencyGraph(cwd) {
  const graph = new Map();
  const packages = await getPackageInfo(cwd);
  let valid = true;

  const pkgRoot = await fs
    .readFile(path.resolve(cwd, "package.json"))
    .then(JSON.parse);

  const packagesByName = {
    [pkgRoot.name]: {
      config: pkgRoot,
      name: pkgRoot.name,
      dir: path.resolve(cwd)
    }
  };

  const queue = [pkgRoot];

  for (const pkg of packages) {
    queue.push(pkg);
    packagesByName[pkg.name] = pkg;
  }

  for (const pkg of queue) {
    const { name } = pkg.config;
    const dependencies = [];
    const allDependencies = getAllDependencies(pkg);

    for (const [depName, depVersion] of allDependencies) {
      const match = packagesByName[depName];
      if (!match) continue;

      const expected = match.config.version;

      // Workspace dependencies only need to semver satisfy, not '==='
      if (!semver.satisfies(expected, depVersion)) {
        valid = false;
        console.error(
          "TODO fix this with proper erroring"
          //   messages.packageMustDependOnCurrentVersion(
          //     name,
          //     depName,
          //     expected,
          //     depVersion
          //   )
        );
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, { pkg, dependencies });
  }
  return { graph, valid };
}
