import getWorkspaces from "get-workspaces";
import fs from "fs-extra";
import path from "path";
import { Workspace } from "@changesets/types";
import getDependencyGraph from "./get-dependency-graph";

export function getDependentsGraphFromWorkspaces(
  workspaces: Workspace[],
  rootWorkspace: Workspace
) {
  const graph: Map<
    string,
    { pkg: Workspace; dependents: string[] }
  > = new Map();

  const { graph: dependencyGraph } = getDependencyGraph(
    rootWorkspace,
    workspaces
  );

  const dependentsLookup: {
    [key: string]: { pkg: Workspace; dependents: Array<string> };
  } = {};

  workspaces.forEach(pkg => {
    dependentsLookup[pkg.config.name] = {
      pkg,
      dependents: []
    };
  });

  workspaces.forEach(pkg => {
    const dependent = pkg.config.name;
    const valFromDependencyGraph = dependencyGraph.get(dependent);
    if (valFromDependencyGraph) {
      const dependencies = valFromDependencyGraph.dependencies;

      dependencies.forEach(dependency => {
        dependentsLookup[dependency].dependents.push(dependent);
      });
    }
  });

  Object.keys(dependentsLookup).forEach(key => {
    graph.set(key, dependentsLookup[key]);
  });

  const simplifiedDependentsGraph: Map<string, string[]> = new Map();

  graph.forEach((pkgInfo, pkgName) => {
    simplifiedDependentsGraph.set(pkgName, pkgInfo.dependents);
  });

  return simplifiedDependentsGraph;
}

export default async function getDependentsGraph({ cwd }: { cwd: string }) {
  const packages = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!packages) {
    throw new Error("could not get packages");
  }
  const graph: Map<
    string,
    { pkg: Workspace; dependents: string[] }
  > = new Map();

  const pkgRoot = await fs
    .readFile(path.resolve(cwd, "package.json"), "utf8")
    .then(JSON.parse);

  const pkgRootConfigged = {
    config: pkgRoot,
    name: pkgRoot.name,
    dir: path.resolve(cwd)
  };

  const { graph: dependencyGraph } = getDependencyGraph(
    pkgRootConfigged,
    packages
  );

  const dependentsLookup: {
    [key: string]: { pkg: Workspace; dependents: Array<string> };
  } = {};

  packages.forEach(pkg => {
    dependentsLookup[pkg.config.name] = {
      pkg,
      dependents: []
    };
  });

  packages.forEach(pkg => {
    const dependent = pkg.config.name;
    const valFromDependencyGraph = dependencyGraph.get(dependent);
    if (valFromDependencyGraph) {
      const dependencies = valFromDependencyGraph.dependencies;

      dependencies.forEach(dependency => {
        dependentsLookup[dependency].dependents.push(dependent);
      });
    }
  });

  Object.keys(dependentsLookup).forEach(key => {
    graph.set(key, dependentsLookup[key]);
  });

  const simplifiedDependentsGraph: Map<string, string[]> = new Map();

  graph.forEach((pkgInfo, pkgName) => {
    simplifiedDependentsGraph.set(pkgName, pkgInfo.dependents);
  });

  return simplifiedDependentsGraph;
}
