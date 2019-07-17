import {
  ReleasePlan,
  Linked,
  ComprehensiveRelease,
  Workspace,
  Config,
  NewChangeset
} from "@changesets/types";
import determineDependents from "./determine-dependents";
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
    // The map passed in to determineDependents will be mutated
    let dependentAdded = determineDependents(
      releases,
      workspaces || [],
      dependentsGraph
    );

    // The map passed in to determineDependents will be mutated
    let linksUpdated = applyLinks(releases, config.linked);

    releaseObjectValidated = !linksUpdated && !dependentAdded;
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
