// This is a modified version of the graph-getting in bolt

/* eslint-disable prefer-destructuring */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import fs from "fs-extra";
import path from "path";
import semver from "semver";

import getWorkspaces from "./getWorkspaces";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "bundledDependencies",
  "optionalDependencies"
];

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

async function getDependencyGraph(packages, cwd) {
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

export default async function getDependentsGraph({ cwd }) {
  const packages = await getWorkspaces({ cwd });
  const graph = new Map();

  const { graph: dependencyGraph } = await getDependencyGraph(packages, cwd);

  const dependentsLookup = {};

  packages.forEach(pkg => {
    dependentsLookup[pkg.config.name] = {
      pkg,
      dependents: []
    };
  });

  packages.forEach(pkg => {
    const dependent = pkg.config.name;
    const valFromDependencyGraph = dependencyGraph.get(dependent) || {};
    const dependencies = valFromDependencyGraph.dependencies || [];

    dependencies.forEach(dependency => {
      dependentsLookup[dependency].dependents.push(dependent);
    });
  });

  // can't use Object.entries here as the flow type for it is Array<[string, mixed]>;
  Object.keys(dependentsLookup).forEach(key => {
    graph.set(key, dependentsLookup[key]);
  });

  const simplifiedDependentsGraph = new Map();

  graph.forEach((pkgInfo, pkgName) => {
    simplifiedDependentsGraph.set(pkgName, pkgInfo.dependents);
  });

  return simplifiedDependentsGraph;
}
