// @flow
import { copyFixtureIntoTempDir } from 'jest-fixtures';
import {
  askCheckboxPlus,
  askList,
  askConfirm,
  askQuestion,
} from '@atlaskit/build-utils/cli';
import { getChangedPackagesSinceMaster } from '@atlaskit/build-utils/packages';
import { changesetCommand } from '../../changeset';
import writeChangeset from '../../changeset/writeChangeset';

/*
    Bumping peerDeps is a tricky issue, so we are testing every single combination here so that
    we can have absolute certainty when changing anything to do with them.
    In general the rule for bumping peerDeps is that:
      * All MINOR or MAJOR peerDep bumps must MAJOR bump all dependents - regardless of ranges
      * Otherwise - normal patching rules apply
 */

jest.mock('@atlaskit/build-utils/logger');
jest.mock('@atlaskit/build-utils/cli');
jest.mock('@atlaskit/build-utils/packages');
jest.mock('@atlaskit/build-utils/git');
jest.mock('../../changeset/writeChangeset');

// This is some sad flow hackery
const unsafeGetChangedPackagesSinceMaster: any = getChangedPackagesSinceMaster;
unsafeGetChangedPackagesSinceMaster.mockReturnValue([]);

type releases = {
  [string]: string,
};
type dependent = {
  name: string,
  type: string,
  dependencies: Array<string>,
};
type mockResponses = {
  summary?: string,
  shouldCommit?: string,
  releases: releases,
  dependents?: Array<dependent>,
};

const mockUserResponses = (mockResponses: mockResponses) => {
  const summary = mockResponses.summary || 'summary message mock';
  const shouldCommit = mockResponses.shouldCommit || 'n';
  askCheckboxPlus.mockReturnValueOnce(Object.keys(mockResponses.releases));
  Object.entries(mockResponses.releases).forEach(([pkg, type]) =>
    askList.mockReturnValueOnce(type),
  );
  askQuestion.mockReturnValueOnce(summary);
  askConfirm.mockReturnValueOnce(shouldCommit);
};

describe('Changesets - bumping peerDeps', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should patch a pinned peerDep', async () => {
    // Bumping a pinned peer dep should patch the dependent - regular bumping rules
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-pinned-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'patch' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'patch' }],
      dependents: [
        {
          name: 'has-peer-dep',
          type: 'patch',
          dependencies: ['depended-upon'],
        },
      ],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should not bump the dependent when bumping a tilde peerDep by patch', async () => {
    // since we aren't leaving the version range AND the bumptype is patch, we should not bump
    // any dependents
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-tilde-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'patch' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'patch' }],
      dependents: [],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should major bump dependent when bumping a tilde peerDep by minor', async () => {
    // minor bump that is leaving version range, therefore: major bump to dependent
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-tilde-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'minor' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'minor' }],
      dependents: [
        {
          name: 'has-peer-dep',
          type: 'major',
          dependencies: ['depended-upon'],
        },
      ],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should major bump dependent when bumping a tilde peerDep by major', async () => {
    // example: same example as above, should major bump the dependent
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-tilde-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'major' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'major' }],
      dependents: [
        {
          name: 'has-peer-dep',
          type: 'major',
          dependencies: ['depended-upon'],
        },
      ],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should not bump dependent when bumping caret peerDep by patch', async () => {
    // example: We are not leaving the semver range, so we should not be bumping
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-caret-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'patch' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'patch' }],
      dependents: [],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should major bump dependent when bumping caret peerDep by minor', async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-caret-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'minor' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'minor' }],
      dependents: [
        {
          name: 'has-peer-dep',
          type: 'major',
          dependencies: ['depended-upon'],
        },
      ],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should major bump dependent when bumping caret peerDep by major', async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-caret-peer-dep',
    );
    mockUserResponses({ releases: { 'depended-upon': 'major' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'depended-upon', type: 'major' }],
      dependents: [
        {
          name: 'has-peer-dep',
          type: 'major',
          dependencies: ['depended-upon'],
        },
      ],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it('should patch bump transitive dep that is only affected by peerDep bump', async () => {
    // example: pkg-b has a caretDep on pkg-a and a caret dep on pkg-c, pkg-c has a caret peerDep
    // on pkg-a.
    // Minor bumping pkg-a should not cause pkg-b to release, but will cause a major on pkg-c, which
    // in turn patches pkg-b
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'previously-checked-transitive-peer-dependent',
    );
    mockUserResponses({ releases: { 'pkg-a': 'minor' } });
    const cs = await changesetCommand({ cwd });

    const expectedChangeset = {
      summary: 'summary message mock',
      releases: [{ name: 'pkg-a', type: 'minor' }],
      dependents: [
        { name: 'pkg-c', type: 'major', dependencies: ['pkg-a'] },
        { name: 'pkg-b', type: 'patch', dependencies: ['pkg-c', 'pkg-a'] },
      ],
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });
});
