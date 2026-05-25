import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import { readConfig } from "@changesets/config";
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

  const configResult = await readConfig(packages.rootDir, packages);
  if (configResult.config == null) {
    throw new Error(
      `Invalid configuration:\n  ${configResult.errors.join("  \n")}`,
    );
  }

  const config = passedConfig
    ? { ...configResult.config, ...passedConfig }
    : configResult.config;

  const changesets = await readChangesets(packages.rootDir, sinceRef);
  const preState = await readPreState(packages.rootDir);

  return assembleReleasePlan(changesets, packages, config, preState);
}

/** @deprecated Use named export `getReleasePlan` instead */
const getReleasePlanDefault = getReleasePlan;
export default getReleasePlanDefault;
