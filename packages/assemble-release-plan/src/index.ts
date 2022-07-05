import {
  ReleasePlan,
  Config,
  NewChangeset,
  PreState,
  PackageGroup
} from "@changesets/types";
import determineDependents from "./determine-dependents";
import flattenReleases from "./flatten-releases";
import matchFixedConstraint from "./match-fixed-constraint";
import applyLinks from "./apply-links";
import { incrementVersion } from "./increment";
import * as semver from "semver";
import { InternalError } from "@changesets/errors";
import { Packages, Package } from "@manypkg/get-packages";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { PreInfo, InternalRelease } from "./types";

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

function getSnapshotVersion(
  release: InternalRelease,
  preInfo: PreInfo | undefined,
  snapshotParameters: {
    preidTemplate: string | null;
    commit: string;
    timestamp: string;
    datetime: string;
    tag: string | undefined;
    useCalculatedVersion: boolean;
  }
): string {
  if (release.type === "none") {
    return release.oldVersion;
  }

  const baseVersion = snapshotParameters.useCalculatedVersion
    ? incrementVersion(release, preInfo)
    : `0.0.0`;

  // This is way to handle the old behavior, where `snapshotPreidTemplate` is not in use.
  // We need a special handling because we need to handle a case where `--snapshot` is used,
  // and the resulting version needs to be composed without a tag.
  if (!snapshotParameters.preidTemplate) {
    const legacySuffix = [snapshotParameters.tag, snapshotParameters.datetime]
      .filter(Boolean)
      .join("-");

    return [baseVersion, legacySuffix].join("-");
  } else {
    const composedSuffix = snapshotParameters.preidTemplate
      .replace("{timestamp}", snapshotParameters.timestamp)
      .replace("{datetime}", snapshotParameters.datetime)
      .replace("{commit}", snapshotParameters.commit)
      .replace("{tag}", () => {
        if (snapshotParameters.tag === undefined) {
          throw new Error(
            'Failed to compose snapshot version: "{tag}" placeholder is used without specifying a tag name'
          );
        }

        return snapshotParameters.tag;
      });

    return [baseVersion, composedSuffix].filter(Boolean).join("-");
  }
}

function getNewVersion(
  release: InternalRelease,
  preInfo: PreInfo | undefined
): string {
  if (release.type === "none") {
    return release.oldVersion;
  }

  return incrementVersion(release, preInfo);
}

function assembleReleasePlan(
  changesets: NewChangeset[],
  packages: Packages,
  config: Config,
  // intentionally not using an optional parameter here so the result of `readPreState` has to be passed in here
  preState: PreState | undefined,
  // snapshot: undefined            ->  not using snaphot
  // snapshot: { tag: undefined }   ->  --snapshot (empty tag)
  // snapsgot: { tag: "canary" }    ->  --snapshot canary
  snapshot?: {
    tag: string | undefined;
    commit: string;
    timestamp: string;
    datetime: string;
  }
): ReleasePlan {
  let packagesByName = new Map(
    packages.packages.map(x => [x.packageJson.name, x])
  );

  const relevantChangesets = getRelevantChangesets(
    changesets,
    config.ignore,
    preState
  );

  const preInfo = getPreInfo(changesets, packagesByName, config, preState);

  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = flattenReleases(
    relevantChangesets,
    packagesByName,
    config.ignore
  );

  let dependencyGraph = getDependentsGraph(packages, {
    bumpVersionsWithWorkspaceProtocolOnly:
      config.bumpVersionsWithWorkspaceProtocolOnly
  });

  let releasesValidated = false;
  while (releasesValidated === false) {
    // The map passed in to determineDependents will be mutated
    let dependentAdded = determineDependents({
      releases,
      packagesByName,
      dependencyGraph,
      preInfo,
      config
    });

    // `releases` might get mutated here
    let fixedConstraintUpdated = matchFixedConstraint(
      releases,
      packagesByName,
      config
    );
    let linksUpdated = applyLinks(releases, packagesByName, config.linked);

    releasesValidated =
      !linksUpdated && !dependentAdded && !fixedConstraintUpdated;
  }

  if (preInfo?.state.mode === "exit") {
    for (let pkg of packages.packages) {
      // If a package had a prerelease, but didn't trigger a version bump in the regular release,
      // we want to give it a patch release.
      // Detailed explanation at https://github.com/changesets/changesets/pull/382#discussion_r434434182
      if (preInfo.preVersions.get(pkg.packageJson.name) !== 0) {
        const existingRelease = releases.get(pkg.packageJson.name);
        if (!existingRelease) {
          releases.set(pkg.packageJson.name, {
            name: pkg.packageJson.name,
            type: "patch",
            oldVersion: pkg.packageJson.version,
            changesets: []
          });
        } else if (
          existingRelease.type === "none" &&
          !config.ignore.includes(pkg.packageJson.name)
        ) {
          existingRelease.type = "patch";
        }
      }
    }
  }

  return {
    changesets: relevantChangesets,
    releases: [...releases.values()].map(incompleteRelease => {
      return {
        ...incompleteRelease,
        newVersion: snapshot
          ? getSnapshotVersion(incompleteRelease, preInfo, {
              commit: snapshot.commit,
              timestamp: snapshot.timestamp,
              datetime: snapshot.datetime,
              tag: snapshot.tag,
              preidTemplate:
                config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
                  .snapshotPreidTemplate,
              useCalculatedVersion:
                config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
                  .useCalculatedVersionForSnapshots
            })
          : getNewVersion(incompleteRelease, preInfo)
      };
    }),
    preState: preInfo?.state
  };
}

function getRelevantChangesets(
  changesets: NewChangeset[],
  ignored: Readonly<string[]>,
  preState: PreState | undefined
): NewChangeset[] {
  for (const changeset of changesets) {
    // Using the following 2 arrays to decide whether a changeset
    // contains both ignored and not ignored packages
    const ignoredPackages = [];
    const notIgnoredPackages = [];
    for (const release of changeset.releases) {
      if (
        ignored.find(ignoredPackageName => ignoredPackageName === release.name)
      ) {
        ignoredPackages.push(release.name);
      } else {
        notIgnoredPackages.push(release.name);
      }
    }

    if (ignoredPackages.length > 0 && notIgnoredPackages.length > 0) {
      throw new Error(
        `Found mixed changeset ${changeset.id}\n` +
          `Found ignored packages: ${ignoredPackages.join(" ")}\n` +
          `Found not ignored packages: ${notIgnoredPackages.join(" ")}\n` +
          "Mixed changesets that contain both ignored and not ignored packages are not allowed"
      );
    }
  }

  if (preState && preState.mode !== "exit") {
    let usedChangesetIds = new Set(preState.changesets);
    return changesets.filter(changeset => !usedChangesetIds.has(changeset.id));
  }

  return changesets;
}

function getHighestPreVersion(
  packageGroup: PackageGroup,
  packagesByName: Map<string, Package>
): number {
  let highestPreVersion = 0;
  for (let pkg of packageGroup) {
    highestPreVersion = Math.max(
      getPreVersion(packagesByName.get(pkg)!.packageJson.version),
      highestPreVersion
    );
  }
  return highestPreVersion;
}

function getPreInfo(
  changesets: NewChangeset[],
  packagesByName: Map<string, Package>,
  config: Config,
  preState: PreState | undefined
): PreInfo | undefined {
  if (preState === undefined) {
    return;
  }

  let updatedPreState = {
    ...preState,
    changesets: changesets.map(changeset => changeset.id),
    initialVersions: {
      ...preState.initialVersions
    }
  };

  for (const [, pkg] of packagesByName) {
    if (updatedPreState.initialVersions[pkg.packageJson.name] === undefined) {
      updatedPreState.initialVersions[pkg.packageJson.name] =
        pkg.packageJson.version;
    }
  }
  // Populate preVersion
  // preVersion is the map between package name and its next pre version number.
  let preVersions = new Map<string, number>();
  for (const [, pkg] of packagesByName) {
    preVersions.set(
      pkg.packageJson.name,
      getPreVersion(pkg.packageJson.version)
    );
  }
  for (let fixedGroup of config.fixed) {
    let highestPreVersion = getHighestPreVersion(fixedGroup, packagesByName);
    for (let fixedPackage of fixedGroup) {
      preVersions.set(fixedPackage, highestPreVersion);
    }
  }
  for (let linkedGroup of config.linked) {
    let highestPreVersion = getHighestPreVersion(linkedGroup, packagesByName);
    for (let linkedPackage of linkedGroup) {
      preVersions.set(linkedPackage, highestPreVersion);
    }
  }

  return {
    state: updatedPreState,
    preVersions
  };
}

export default assembleReleasePlan;
