import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import { read } from "@changesets/config";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import type { Config, ReleasePlan } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";

export async function getReleasePlan(
  cwd: string,
  sinceRef?: string,
  passedConfig?: Config,
): Promise<ReleasePlan> {
  const packages = await getPackages(cwd);
  const preState = await readPreState(packages.rootDir);

  const { config: readConfig } = await read(packages.rootDir, packages);
  if (readConfig == null) {
    throw new Error("Found errors in config.");
  }

  const config = passedConfig ? { ...readConfig, ...passedConfig } : readConfig;
  const changesets = await readChangesets(packages.rootDir, sinceRef);

  return assembleReleasePlan(changesets, packages, config, preState);
}

/** @deprecated Use named export `getReleasePlan` instead */
const getReleasePlanDefault = getReleasePlan;
export default getReleasePlanDefault;
