import assembleReleasePlan from "@changesets/assemble-release-plan";
import readChangesets from "@changesets/read";
import { read } from "@changesets/config";
import type { Config, ReleasePlan } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { readPreState } from "@changesets/pre";

export default async function getReleasePlan(
  cwd: string,
  sinceRef?: string,
  passedConfig?: Config,
): Promise<ReleasePlan> {
  const { root, packages, tool } = await getPackages(cwd);
  const preState = await readPreState(root.dir);
  const readConfig = await read(root.dir, {
    root,
    packages,
    tool: { type: tool },
  });
  const config = passedConfig ? { ...readConfig, ...passedConfig } : readConfig;
  const changesets = await readChangesets(root.dir, sinceRef);

  return assembleReleasePlan(
    changesets,
    {
      root,
      packages,
      tool: { type: tool },
    },
    config,
    preState,
  );
}
