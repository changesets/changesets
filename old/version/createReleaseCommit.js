const outdent = require('outdent');

/** Publish commit message format

  RELEASING: Releasing 3 package(s)

  Releases:
    package-a@2.0.0

  Dependents:
    package-a@2.0.0
    package-b@1.1.0
    package-c@1.0.1
  ---
  {releases:[{name:'package-a',version:'2.0.0',commits:['fc4229d'],dependencies:['package-c']},{name:'package-b'version:'1.1.0',commits:['fc4229d'],dependencies:['package-a']},{name:'package-c'version:'1.0.1',commits:['fc4229d'],dependencies:['package-b']}]changesets:[ < Changeset > ]}
  ---

  [skip ci]
 *
 */

// releaseObj is a Release object created from the createReleaseObject function
// To create the commit string for a release, we mostly JSON.stringify, removing a few extraneous
// fields

// This data is not depended upon by the publish step, but can be useful for other tools/debugging
// I believe it would be safe to deprecate this format
function createReleaseCommit(releaseObj, skipCi) {
  const numPackagesReleased = releaseObj.releases.length;

  const cleanReleaseObj = {};
  cleanReleaseObj.releases = releaseObj.releases;
  cleanReleaseObj.changesets = releaseObj.changesets.map(changeset => ({
    commit: changeset.commit,
    summary: changeset.summary,
  }));

  const releasesLines = releaseObj.releases
    .map(release => `  ${release.name}@${release.version}`)
    .join('\n');
  const dependentsLines =
    releaseObj.releases
      .filter(
        release => release.dependencies && release.dependencies.length > 0,
      )
      .map(release => `  ${release.name}@${release.version}`)
      .join('\n') || '[]';
  const deletedLines =
    releaseObj.deleted.map(deleted => `  ${deleted.name}`).join('\n') || '  []';

  return outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}

    Dependents:
      ${dependentsLines}

    Deleted:
    ${deletedLines}

    ---
    ${JSON.stringify(cleanReleaseObj)}
    ---
    ${skipCi ? '\n\n[skip ci]' : ''}
`;
}

module.exports = createReleaseCommit;
