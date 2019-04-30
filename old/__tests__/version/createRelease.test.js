const createRelease = require('../../version/createRelease');

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
const simpleChangeset2 = {
  summary: 'This is another summary',
  releases: [{ name: 'package-a', type: 'patch' }],
  dependents: [],
  commit: '695fad0',
};

const changesetWithDep = {
  summary: 'This is another summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [
    { name: 'package-b', type: 'patch', dependencies: ['package-a'] },
  ],
  commit: '695fad0',
};

const changesetWithCircularDep = {
  summary: 'This is another summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [
    { name: 'package-a', type: 'patch', dependencies: ['package-a'] },
  ],
  commit: '695fad0',
};

const changesetWithNone = {
  summary: 'This is another summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [
    { name: 'package-b', type: 'none', dependencies: ['package-a'] },
  ],
  commit: '695fad0',
};

const changesetWithDeletedPackage = {
  summary: 'This is another summary',
  releases: [{ name: 'package-a', type: 'minor' }],
  dependents: [
    { name: 'package-b', type: 'patch', dependencies: ['package-a'] },
    { name: 'package-c', type: 'patch', dependencies: [] },
  ],
  commit: '695fad0',
};

describe('createRelease', () => {
  it('should handle a single simple changeset', () => {
    const releaseObj = createRelease([simpleChangeset], fakeAllPackages);
    expect(releaseObj).toEqual({
      releases: [{ name: 'package-a', commits: ['dec4a66'], version: '1.1.0' }],
      deleted: [],
      changesets: [simpleChangeset],
    });
  });

  it('should flatten flatten commits in two simple changesets', () => {
    const releaseObj = createRelease(
      [simpleChangeset, simpleChangeset2],
      fakeAllPackages,
    );

    expect(releaseObj).toEqual({
      releases: [
        {
          name: 'package-a',
          commits: ['dec4a66', '695fad0'],
          version: '1.1.0',
        },
      ],
      deleted: [],
      changesets: [simpleChangeset, simpleChangeset2],
    });
  });

  it('should flatten commits in changeset with circular dependency', () => {
    const releaseObj = createRelease(
      [changesetWithCircularDep],
      fakeAllPackages,
    );

    expect(releaseObj).toEqual({
      releases: [
        {
          name: 'package-a',
          commits: ['695fad0'],
          version: '1.1.0',
        },
      ],
      deleted: [],
      changesets: [changesetWithCircularDep],
    });
  });

  it('should handle dependents', () => {
    const releaseObj = createRelease([changesetWithDep], fakeAllPackages);

    expect(releaseObj).toEqual({
      releases: [
        { name: 'package-a', commits: ['695fad0'], version: '1.1.0' },
        { name: 'package-b', commits: ['695fad0'], version: '1.0.1' },
      ],
      deleted: [],
      changesets: [changesetWithDep],
    });
  });

  it('should handle a none release', () => {
    const releaseObj = createRelease([changesetWithNone], fakeAllPackages);

    expect(releaseObj).toEqual({
      releases: [{ name: 'package-a', commits: ['695fad0'], version: '1.1.0' }],
      deleted: [],
      changesets: [changesetWithNone],
    });
  });

  it('should handle a deleted package', () => {
    const releaseObj = createRelease(
      [changesetWithDeletedPackage],
      fakeAllPackages,
    );

    expect(releaseObj).toEqual({
      releases: [
        { name: 'package-a', commits: ['695fad0'], version: '1.1.0' },
        { name: 'package-b', commits: ['695fad0'], version: '1.0.1' },
      ],
      deleted: [
        {
          commits: ['695fad0'],
          name: 'package-c',
          version: null,
        },
      ],
      changesets: [changesetWithDeletedPackage],
    });
  });
});
