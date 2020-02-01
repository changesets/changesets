import getWorkspaces from "get-workspaces";
import { Workspace } from "@changesets/types";
import getDependencyGraph from "./get-dependency-graph";

export default async function getDependentsGraph({ cwd }: { cwd: string }) {
  const packages = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "pnpm", "root"]
  });

  if (!packages) {
    throw new Error("could not get packages");
  }
  const graph: Map<
    string,
    { pkg: Workspace; dependents: string[] }
  > = new Map();

  const { graph: dependencyGraph } = await getDependencyGraph(packages, cwd);

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
