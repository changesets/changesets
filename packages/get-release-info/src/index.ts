import read from "@changesets/read";
import getDependentsGraph from "get-dependents-graph";
import getWorkspaces from "get-workspaces";
import { Changeset } from "@changesets/types";
import determineDependents from "@changesets/determine-dependents";

export default async function(cwd: string): Promise<Changeset[]> {
  let changesets = await read(cwd);
  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });
  let dependentsGraph = await getDependentsGraph({ cwd });

  let changesetWithDependents = await Promise.all(
    changesets.map(async changeset => {
      const dependents = await determineDependents(
        changeset,
        workspaces || [],
        dependentsGraph,
        {}
      );

      return { ...changeset, dependents };
    })
  );
  return changesetWithDependents;
}
