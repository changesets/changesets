import getWorkspaces from "./getWorkspaces";
import getDependencyGraph from "./getDependencyGraph";

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
