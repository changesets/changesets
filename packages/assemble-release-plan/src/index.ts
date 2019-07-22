import {
  ReleasePlan,
  Workspace,
  Config,
  NewChangeset
} from "@changesets/types";
import determineDependents from "./determine-dependents";
import flattenReleases from "./flatten-releases";
import applyLinks from "./apply-links";

function assembleReleasePlan(
  changesets: NewChangeset[],
  workspaces: Workspace[],
  dependentsGraph: Map<string, string[]>,
  config: Config
): ReleasePlan {
  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = flattenReleases(changesets, workspaces);

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

export default assembleReleasePlan;
