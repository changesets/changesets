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
  let releases = await flattenReleases(changesets, workspaces);

  let releaseObjectValidated = false;
  while (releaseObjectValidated === false) {
    let newDependents = determineDependents(
      releases,
      workspaces || [],
      dependentsGraph
    );
    if (newDependents.length) {
      releases.concat(newDependents);
      continue;
    }
    let { releases: linkAppliedReleases, updated } = applyLinks(
      releases,
      config.linked
    );

    if (updated) {
      releases = linkAppliedReleases;
      continue;
    }
    releaseObjectValidated = false;
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
