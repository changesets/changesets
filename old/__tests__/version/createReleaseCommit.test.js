const outdent = require('outdent');
const createRelease = require('../../version/createRelease');
const createReleaseCommit = require('../../version/createReleaseCommit');

const fakeAllPackages = [
  { name: 'package-a', config: { version: '1.0.0' } },
  { name: 'package-b', config: { version: '1.0.0' } },
];
const simpleChangeset = {
  summary: 'This is a summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [],
  commit: 'dec4a66',
};
const simpleChangesetWithDeleted = {
  summary: 'This is a summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [{ name: 'package-c', type: 'patch' }],
  commit: 'dec4a66',
};
const simpleChangeset2 = {
  summary: 'This is another summary',
  releases: [
    { name: 'package-a', type: 'patch' },
    { name: 'package-b', type: 'minor' },
  ],
  dependents: [],
  commit: '695fad0',
};

describe('createReleaseCommit', () => {
  it('should handle a single simple releaseObject with one released package', () => {
    const releaseObj = createRelease([simpleChangeset], fakeAllPackages);
    const commitStr = createReleaseCommit(releaseObj);
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 1 package(s)

      Releases:
        package-a@1.1.0

      Dependents:
        []

      Deleted:
        []

      ---
      {"releases":[{"name":"package-a","commits":["dec4a66"],"version":"1.1.0"}],"changesets":[{"commit":"dec4a66","summary":"This is a summary"}]}
      ---

    `);
  });
  it('should skip CI when the flag is passed', () => {
    const releaseObj = createRelease([simpleChangeset], fakeAllPackages);
    const commitStr = createReleaseCommit(releaseObj, { skipCI: true });
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 1 package(s)

      Releases:
        package-a@1.1.0

      Dependents:
        []

      Deleted:
        []

      ---
      {"releases":[{"name":"package-a","commits":["dec4a66"],"version":"1.1.0"}],"changesets":[{"commit":"dec4a66","summary":"This is a summary"}]}
      ---


      [skip ci]
    `);
  });

  it('should handle a single simple releaseObject with deleted package', () => {
    const releaseObj = createRelease(
      [simpleChangesetWithDeleted],
      fakeAllPackages,
    );
    const commitStr = createReleaseCommit(releaseObj);
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 1 package(s)

      Releases:
        package-a@1.1.0

      Dependents:
        []

      Deleted:
        package-c

      ---
      {"releases":[{"name":"package-a","commits":["dec4a66"],"version":"1.1.0"}],"changesets":[{"commit":"dec4a66","summary":"This is a summary"}]}
      ---

    `);
  });

  it('should handle a multiple releases from one changeset', () => {
    const releaseObj = createRelease([simpleChangeset2], fakeAllPackages);
    const commitStr = createReleaseCommit(releaseObj);
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 2 package(s)

      Releases:
        package-a@1.0.1
        package-b@1.1.0

      Dependents:
        []

      Deleted:
        []

      ---
      {"releases":[{"name":"package-a","commits":["695fad0"],"version":"1.0.1"},{"name":"package-b","commits":["695fad0"],"version":"1.1.0"}],"changesets":[{"commit":"695fad0","summary":"This is another summary"}]}
      ---

    `);
  });

  it('should handle a merging releases from multiple changesets', () => {
    const releaseObj = createRelease(
      [simpleChangeset, simpleChangeset2],
      fakeAllPackages,
    );
    const commitStr = createReleaseCommit(releaseObj);

    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 2 package(s)

      Releases:
        package-a@1.1.0
        package-b@1.1.0

      Dependents:
        []

      Deleted:
        []

      ---
      {"releases":[{"name":"package-a","commits":["dec4a66","695fad0"],"version":"1.1.0"},{"name":"package-b","commits":["695fad0"],"version":"1.1.0"}],"changesets":[{"commit":"dec4a66","summary":"This is a summary"},{"commit":"695fad0","summary":"This is another summary"}]}
      ---

    `);
  });
});
