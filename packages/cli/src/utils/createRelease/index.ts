import semver from "semver";
import flattenChangesets from "./flattenChangesets";
import { Changeset, BumpType } from "../types";
import { Workspace } from "get-workspaces";
/*
  This flattens an array of Version objects into one object that can be used to create the changelogs
  and the publish commit messages.

  Dependents will be calculated and added to releases, then final versions will be calculated.

  It's output will look like

  {
    releases: [{
      name: 'package-a',
      version: '2.0.0',                // actual version being released
      commits: ['fc4229d'],            // filtered to ones for this pkg
                                       // (used in changelogs)
      dependencies: ['package-c']      // list of dependencies that will need to be updated
    },
    {
      name: 'package-b'
      version: '1.1.0',
      commits: ['fc4229d'],           // these would be the commits that caused bumps
      dependencies: ['package-a']
    },
    {
      name: 'package-c'
      version: '1.0.1',
      commits: ['fc4229d'],
      dependencies: ['package-b']
    }]

    changesets: [<Changeset>] // References to all the changesets used to build Release
                              // to be able to look up summary and release notes
                              // information when building changelogs
  }
*/

export default function createRelease(
  changesets: Array<Changeset>,
  allPackages: Array<Workspace>,
  allLinkedPackages = []
) {
  // First, combine all the changeset.releases into one useful array

  const flattenedChangesets = flattenChangesets(changesets, allLinkedPackages);

  let currentVersions = new Map();

  for (let pkg of allPackages) {
    currentVersions.set(
      pkg.name,
      // @ts-ignore
      pkg.config.version !== undefined ? pkg.config.version : null
    );
  }

  for (let linkedPackages of allLinkedPackages) {
    let highestVersion;
    for (let linkedPackage of linkedPackages) {
      let version = currentVersions.get(linkedPackage);
      if (highestVersion === undefined || semver.gt(version, highestVersion)) {
        highestVersion = version;
      }
    }
    for (let linkedPackage of linkedPackages) {
      currentVersions.set(linkedPackage, highestVersion);
    }
  }

  const allReleases: Array<{
    name: string;
    type: BumpType;
    changesets: Array<string>;
    commits: Array<string>;
    version?: string | null;
  }> = [];

  for (let flattenedChangeset of flattenedChangesets) {
    if (flattenedChangeset.type === "none") {
      continue;
    }
    allReleases.push({
      ...flattenedChangeset,
      version: semver.inc(
        currentVersions.get(flattenedChangeset.name),
        flattenedChangeset.type
      )
    });
  }

  return {
    releases: allReleases.filter(release => release.version !== null),
    deleted: allReleases.filter(release => release.version === null),
    changesets
  };
}
