import type { Packages, Package } from "@manypkg/get-packages";
import getDependencyGraph from "./get-dependency-graph.ts";

export function getDependentsGraph(
  packages: Packages,
  opts?: {
    ignoreDevDependencies?: boolean;
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  }
) {
  const graph: Map<string, { pkg: Package; dependents: string[] }> = new Map();

  const rootPackage = packages.rootPackage;
  if (rootPackage == null) {
    return new Map();
  }

  const { graph: dependencyGraph } = getDependencyGraph(
    packages,
    rootPackage,
    opts
  );

  const dependentsLookup: {
    [key: string]: { pkg: Package; dependents: Array<string> };
  } = {
    [rootPackage.packageJson.name]: {
      pkg: rootPackage,
      dependents: [],
    },
  };

  packages.packages.forEach((pkg) => {
    dependentsLookup[pkg.packageJson.name] = {
      pkg,
      dependents: [],
    };
  });

  packages.packages.forEach((pkg) => {
    const dependent = pkg.packageJson.name;
    const valFromDependencyGraph = dependencyGraph.get(dependent);
    if (valFromDependencyGraph) {
      const dependencies = valFromDependencyGraph.dependencies;

      dependencies.forEach((dependency) => {
        dependentsLookup[dependency].dependents.push(dependent);
      });
    }
  });

  Object.keys(dependentsLookup).forEach((key) => {
    graph.set(key, dependentsLookup[key]);
  });

  const simplifiedDependentsGraph: Map<string, string[]> = new Map();

  graph.forEach((pkgInfo, pkgName) => {
    simplifiedDependentsGraph.set(pkgName, pkgInfo.dependents);
  });

  return simplifiedDependentsGraph;
}
