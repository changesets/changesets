import { Workspace } from "get-workspaces";
import { getDependencyGraph } from "get-dependency-graph";

type Options = {
  packages: Array<Workspace>;
  root: Workspace;
};

export default function getDependentsGraph({ packages, root }: Options) {
  const graph = new Map();

  const { graph: dependencyGraph } = getDependencyGraph({
    packages,
    root
  });

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
    if (valFromDependencyGraph !== undefined) {
      const dependencies = valFromDependencyGraph.dependencies;

      dependencies.forEach(dependency => {
        dependentsLookup[dependency].dependents.push(dependent);
      });
    }
  });

  // can't use Object.entries here as the flow type for it is Array<[string, mixed]>;
  Object.keys(dependentsLookup).forEach(key => {
    graph.set(key, dependentsLookup[key]);
  });

  const simplifiedDependentsGraph = new Map<string, Array<string>>();

  graph.forEach((pkgInfo, pkgName) => {
    simplifiedDependentsGraph.set(pkgName, pkgInfo.dependents);
  });

  return simplifiedDependentsGraph;
}
