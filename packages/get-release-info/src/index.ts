import read from "@changesets/read";
import getDependentsGraph from "get-dependents-graph";
import getWorkspaces from "get-workspaces";
import determineDependents from "@changesets/determine-dependents";

export default async function(cwd: string) {
  const changesets = await read(cwd);
  const dependentsGraph = await getDependentsGraph({ cwd });
  const workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });
  const dependents = await determineDependents(
    changesets,
    workspaces,
    dependentsGraph
  );
  return { changesets, dependents };
}
