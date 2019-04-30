const semver = require('semver');
const flattenChangesets = require('./flattenChangesets');
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

function getCurrentVersion(packageName, allPackages) {
  const pkg = allPackages.find(p => p.name === packageName);
  // When changeset contains deleted package returning null as its version
  return pkg ? pkg.config.version : null;
}

function createRelease(changesets, allPackages) {
  // First, combine all the changeset.releases into one useful array
  const flattenedChangesets = flattenChangesets(changesets);

  const allReleases = flattenedChangesets
    // do not update none packages
    .filter(release => release.type !== 'none')
    // get the current version for each package
    .map(release => ({
      ...release,
      version: getCurrentVersion(release.name, allPackages),
    }))
    // update to new version for each package
    .map(release => ({
      ...release,
      version: semver.inc(release.version, release.type),
    }))
    // strip out type field
    .map(({ type, ...rest }) => rest);

  return {
    releases: allReleases.filter(release => release.version !== null),
    deleted: allReleases.filter(release => release.version === null),
    changesets,
  };
}

module.exports = createRelease;
