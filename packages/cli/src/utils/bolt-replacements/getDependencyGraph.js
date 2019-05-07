// This is a modified version of the graph-getting in bolt

import fs from "fs-extra";
import path from "path";
import semver from "semver";
import * as boltMessages from "bolt/dist/modern/utils/messages";

import { DEPENDENCY_TYPES } from "../constants";

const getAllDependencies = config => {
  const allDependencies = new Map();

  for (const type of DEPENDENCY_TYPES) {
    const deps = config[type];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      allDependencies.set(name, deps[name]);
    }
  }

  return allDependencies;
};

export default async function getDependencyGraph(packages, cwd) {
  const graph = new Map();
  let valid = true;

  const pkgRoot = await fs
    .readFile(path.resolve(cwd, "package.json"))
    .then(JSON.parse);

  const pkgRootConfigged = {
    config: pkgRoot,
    name: pkgRoot.name,
    dir: path.resolve(cwd)
  };

  const packagesByName = { [pkgRoot.name]: pkgRootConfigged };

  const queue = [pkgRootConfigged];

  for (const pkg of packages) {
    queue.push(pkg);
    packagesByName[pkg.name] = pkg;
  }

  for (const pkg of queue) {
    const { name } = pkg.config;
    const dependencies = [];
    const allDependencies = getAllDependencies(pkg.config);

    for (const [depName, depVersion] of allDependencies) {
      const match = packagesByName[depName];
      if (!match) continue;

      const expected = match.config.version;

      // Workspace dependencies only need to semver satisfy, not '==='
      if (!semver.satisfies(expected, depVersion)) {
        valid = false;
        console.error(
          boltMessages.packageMustDependOnCurrentVersion(
            name,
            depName,
            expected,
            depVersion
          )
        );
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, { pkg, dependencies });
  }
  return { graph, valid };
}
