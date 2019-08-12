// This is a modified version of the graph-getting in bolt

import fs from "fs-extra";
import path from "path";
import semver from "semver";
import chalk from "chalk";
import { PackageJSON, Workspace } from "@changesets/types";
// @ts-ignore

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

const getAllDependencies = (config: PackageJSON) => {
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

export default async function getDependencyGraph(
  packages: Array<Workspace>,
  cwd: string
): Promise<{
  graph: Map<string, { pkg: Workspace; dependencies: Array<string> }>;
  valid: boolean;
}> {
  const graph = new Map<
    string,
    { pkg: Workspace; dependencies: Array<string> }
  >();
  let valid = true;

  const pkgRoot = await fs
    .readFile(path.resolve(cwd, "package.json"), "utf8")
    .then(JSON.parse);

  const pkgRootConfigged = {
    config: pkgRoot,
    name: pkgRoot.name,
    dir: path.resolve(cwd)
  };

  const packagesByName: { [key: string]: Workspace } = {
    [pkgRoot.name]: pkgRootConfigged
  };

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
          `Package ${chalk.cyan(
            `"${name}"`
          )} must depend on the current version of ${chalk.cyan(
            `"${depName}"`
          )}: ${chalk.green(`"${expected}"`)} vs ${chalk.red(
            `"${depVersion}"`
          )}`
        );
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, { pkg, dependencies });
  }
  return { graph, valid };
}
