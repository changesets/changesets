// This is a modified version of the graph-getting in bolt

import semver from "semver";
// @ts-ignore
import * as boltMessages from "bolt/dist/modern/utils/messages";
import { Workspace, PackageJSON } from "get-workspaces";

import { DEPENDENCY_TYPES } from "./constants";

const getAllDependencies = (config: any) => {
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

type Options = {
  cwd: string;
  workspaces: Array<Workspace>;
  rootPkg: PackageJSON;
};

export default async function getDependencyGraph({
  workspaces,
  cwd,
  rootPkg
}: Options) {
  const graph = new Map<
    string,
    { pkg: Workspace; dependencies: Array<string> }
  >();
  let valid = true;

  const pkgRootConfigged = {
    config: rootPkg,
    name: rootPkg.name,
    dir: cwd
  };

  const packagesByName = {
    [rootPkg.name]: pkgRootConfigged
  } as { [key: string]: Workspace };

  const queue = [pkgRootConfigged];

  for (const pkg of workspaces) {
    queue.push(pkg);
    packagesByName[pkg.name] = pkg;
  }

  for (const pkg of queue) {
    const { name } = pkg.config;
    const dependencies: Array<string> = [];
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
