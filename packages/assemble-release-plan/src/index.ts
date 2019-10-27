import {
  ReleasePlan,
  Workspace,
  Config,
  NewChangeset,
  PreState,
  VersionType
} from "@changesets/types";
import determineDependents from "./determine-dependents";
import flattenReleases from "./flatten-releases";
import applyLinks from "./apply-links";
import { incrementVersion } from "./increment";
import * as semver from "semver";

function assembleReleasePlan(
  changesets: NewChangeset[],
  workspaces: Workspace[],
  dependentsGraph: Map<string, string[]>,
  config: Config,
  preState: PreState | undefined
): ReleasePlan {
  let updatedPreState: PreState | undefined =
    preState === undefined
      ? undefined
      : {
          ...preState,
          initialVersions: {
            ...preState.initialVersions
          },
          version: preState.version + 1
        };

  if (updatedPreState !== undefined) {
    for (let workspace of workspaces) {
      if (updatedPreState.initialVersions[workspace.name] === undefined) {
        updatedPreState.initialVersions[workspace.name] =
          workspace.config.version;
      }
    }
    if (updatedPreState.mode !== "exit") {
      let usedChangesetIds = new Set(updatedPreState.changesets);
      updatedPreState.changesets = changesets.map(x => x.id);
      changesets = changesets.filter(
        changeset => !usedChangesetIds.has(changeset.id)
      );
    }
  }
  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = flattenReleases(changesets, workspaces);

  if (updatedPreState !== undefined && updatedPreState.mode === "exit") {
    for (let workspace of workspaces) {
      if (semver.parse(workspace.config.version)!.prerelease.length) {
        if (!releases.has(workspace.name)) {
          releases.set(workspace.name, {
            type: "patch",
            name: workspace.name,
            changesets: [],
            oldVersion: updatedPreState.initialVersions[workspace.name]
          });
        }
      }
    }
  }

  let releaseObjectValidated = false;
  while (releaseObjectValidated === false) {
    // The map passed in to determineDependents will be mutated
    let dependentAdded = determineDependents(
      releases,
      workspaces,
      dependentsGraph,
      updatedPreState
    );

    // The map passed in to determineDependents will be mutated
    let linksUpdated = applyLinks(releases, workspaces, config.linked);

    releaseObjectValidated = !linksUpdated && !dependentAdded;
  }

  return {
    changesets,
    releases: [...releases.values()].map(incompleteRelease => {
      return {
        ...incompleteRelease,
        newVersion: incrementVersion(incompleteRelease, updatedPreState)!
      };
    }),
    preState: updatedPreState
  };
}

export default assembleReleasePlan;
