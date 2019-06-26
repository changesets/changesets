import read from "@changesets/read";
import getDependentsGraph from "get-dependents-graph";
import getWorkspaces from "get-workspaces";
import {
  ReleasePlan,
  Linked,
  ComprehensiveRelease,
  Workspace,
  Config,
  NewChangeset
} from "@changesets/types";
import determineDependents from "@changesets/determine-dependents";
import flattenReleases from "./flatten-releases";
import path from "path";

function getConfig(cwd: string) {
  const configPath = path.resolve(cwd, ".changeset", "config.js");

  return require(configPath);
}

async function createReleasePlan(
  changesets: NewChangeset[],
  workspaces: Workspace[],
  dependentsGraph: Map<string, string[]>,
  config: Config
): Promise<ReleasePlan> {
  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = await flattenReleases(changesets, workspaces);

  let releaseObjectValidated = false;
  while (releaseObjectValidated === false) {
    let {
      releases: dependentReleases,
      updated: dependentAdded
    } = determineDependents(releases, workspaces || [], dependentsGraph);
    if (dependentAdded) {
      releases = dependentReleases;
    }
    let { releases: linkAppliedReleases, updated } = applyLinks(
      releases,
      config.linked
    );

    if (updated) {
      releases = linkAppliedReleases;
    }
    releaseObjectValidated = !updated && !dependentAdded;
  }

  return { changesets, releases };
}

export default async function getReleasePlan(
  cwd: string
): Promise<ReleasePlan> {
  let changesets = await read(cwd);
  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });
  let config = await getConfig(cwd);
  let dependentsGraph = await getDependentsGraph({ cwd });

  return createReleasePlan(
    changesets,
    workspaces || [],
    dependentsGraph,
    config
  );
}

// This obv should not live in this file
function applyLinks(
  releases: ComprehensiveRelease[],
  linked: Linked
): { releases: ComprehensiveRelease[]; updated: boolean } {
  let updated = false;

  for (linkedSet in linked) {
  }

  return { updated };
}
