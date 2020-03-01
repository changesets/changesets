import assembleReleasePlan from "@changesets/assemble-release-plan";
import readChangesets from "@changesets/read";
import getWorkspaces from "get-workspaces";
import getDependentsgraph from "get-dependents-graph";
import { read } from "@changesets/config";
import { Config, ReleasePlan } from "@changesets/types";
import { readPreState } from "@changesets/pre";

export default async function getReleasePlan(
  cwd: string,
  sinceRef?: string,
  passedConfig?: Config
): Promise<ReleasePlan> {
  const workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "pnpm", "root"]
  });

  if (!workspaces)
    throw new Error(
      "Could not resolve workspaces for current working directory"
    );

  const preState = await readPreState(cwd);
  const dependentsGraph = await getDependentsgraph({ cwd });
  const readConfig = await read(cwd, workspaces);
  const config = passedConfig ? { ...readConfig, ...passedConfig } : readConfig;
  const changesets = await readChangesets(cwd, sinceRef);

  return assembleReleasePlan(
    changesets,
    workspaces,
    dependentsGraph,
    config,
    preState
  );
}
