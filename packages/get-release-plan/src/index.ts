import assembleReleasePlan from "@changesets/assemble-release-plan";
import readChangesets from "@changesets/read";
import getWorkspaces from "get-workspaces";
import getDependentsgraph from "get-dependents-graph";
import { read } from "@changesets/config";
import { Config, ReleasePlan } from "@changesets/types";

export default async function getReleasePlan(
  cwd: string,
  sinceMaster: boolean = false,
  passedConfig?: Config
): Promise<ReleasePlan> {
  const workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!workspaces)
    throw new Error(
      "Could not resolve workspaes for current working directory"
    );

  const dependentsGraph = await getDependentsgraph({ cwd });
  const readConfig = await read(cwd, workspaces);
  const config = passedConfig ? { ...readConfig, ...passedConfig } : readConfig;
  const changesets = await readChangesets(cwd, sinceMaster);

  return assembleReleasePlan(changesets, workspaces, dependentsGraph, config);
}
