import {
  ReleasePlan,
  Workspace,
  Config,
  NewChangeset,
  PreState
} from "@changesets/types";
import determineDependents from "./determine-dependents";
import flattenReleases from "./flatten-releases";
import applyLinks from "./apply-links";
import { incrementVersion } from "./increment";
import * as semver from "semver";
import { InternalError } from "@changesets/errors";
import { PreInfo } from "./types";

function getPreVersion(version: string) {
  let parsed = semver.parse(version)!;
  let preVersion =
    parsed.prerelease[1] === undefined ? -1 : parsed.prerelease[1];
  if (typeof preVersion !== "number") {
    throw new InternalError("preVersion is not a number");
  }
  preVersion++;
  return preVersion;
}

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
          }
        };

  let workspacesByName = new Map(workspaces.map(x => [x.name, x]));

  let unfilteredChangesets = changesets;

  let preVersions = new Map();
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
      for (let workspace of workspaces) {
        preVersions.set(
          workspace.name,
          getPreVersion(workspace.config.version)
        );
      }
      for (let linkedGroup of config.linked) {
        let highestPreVersion = 0;
        for (let linkedPackage of linkedGroup) {
          highestPreVersion = Math.max(
            getPreVersion(workspacesByName.get(linkedPackage)!.config.version),
            highestPreVersion
          );
        }
        for (let linkedPackage of linkedGroup) {
          preVersions.set(linkedPackage, highestPreVersion);
        }
      }
    }
    for (let workspace of workspaces) {
      workspacesByName.set(workspace.name, {
        ...workspace,
        config: {
          ...workspace.config,
          version: updatedPreState.initialVersions[workspace.name]
        }
      });
    }
  }

  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = flattenReleases(changesets, workspacesByName);

  if (updatedPreState !== undefined) {
    if (updatedPreState.mode === "exit") {
      for (let workspace of workspaces) {
        if (preVersions.get(workspace.name) !== -1) {
          if (!releases.has(workspace.name)) {
            releases.set(workspace.name, {
              type: "patch",
              name: workspace.name,
              changesets: [],
              oldVersion: workspace.config.version
            });
          }
        }
      }
    } else {
      // for every release in pre mode, we want versions to be bumped to the highest bump type
      // across all the changesets even if the package doesn't have a changeset that releases
      // to the highest bump type in a given release in pre mode and importantly
      // we don't want to add any new releases, we only want to update ones that will already happen
      // because if they're not being released, the version will already have been bumped with the highest bump type
      let releasesFromUnfilteredChangesets = flattenReleases(
        unfilteredChangesets,
        workspacesByName
      );

      releases.forEach((value, key) => {
        let releaseFromUnfilteredChangesets = releasesFromUnfilteredChangesets.get(
          key
        );
        if (releaseFromUnfilteredChangesets === undefined) {
          throw new InternalError(
            "releaseFromUnfilteredChangesets is undefined"
          );
        }

        releases.set(key, {
          ...value,
          // note that we're only setting the type, not the changesets which could be different(the name and oldVersion would be the same so they don't matter)
          // because the changesets on a given release refer to why a given package is being released
          // NOT why it's being released with a given bump type
          // (the bump type could change because of this, linked or peer dependencies)
          type: releaseFromUnfilteredChangesets.type
        });
      });
    }
  }

  let preInfo: PreInfo | undefined =
    updatedPreState === undefined
      ? undefined
      : {
          state: updatedPreState,
          preVersions
        };

  let releaseObjectValidated = false;
  while (releaseObjectValidated === false) {
    // The map passed in to determineDependents will be mutated
    let dependentAdded = determineDependents(
      releases,
      workspacesByName,
      dependentsGraph,
      preInfo
    );

    // The map passed in to determineDependents will be mutated
    let linksUpdated = applyLinks(releases, workspacesByName, config.linked);

    releaseObjectValidated = !linksUpdated && !dependentAdded;
  }

  return {
    changesets,
    releases: [...releases.values()].map(incompleteRelease => {
      return {
        ...incompleteRelease,
        newVersion: incrementVersion(incompleteRelease, preInfo)!
      };
    }),
    preState: updatedPreState
  };
}

export default assembleReleasePlan;
