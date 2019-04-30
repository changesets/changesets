import { copyFixtureIntoTempDir } from 'jest-fixtures';

const bolt = require('bolt');
const git = require('@atlaskit/build-utils/git');
const runRelease = require('../../publish/publishCommand');
// avoid polluting test logs with error message in console
const consoleError = console.error;

jest.mock('@atlaskit/build-utils/cli');
jest.mock('@atlaskit/build-utils/git');
jest.mock('@atlaskit/build-utils/logger');
jest.mock('../../changeset/parseChangesetCommit');

git.tag.mockImplementation(() => Promise.resolve(true));
// we want to keep other bolt commands still running so our tests are more e2e
// NOTE: This is pretty terrible. Quite obviously bolt is not going to return these results
// each time, but there is only one test that uses the output of this function ('should add git tags')
// and we know this will be heavily refactored once its moved into the bolt org anyway. So we are happy
// to keep this debt in for now. LB takes full responsibility for this if it becomes flakey.
bolt.publishPackages = jest.fn(() =>
  Promise.resolve([
    { name: 'pkg-a', newVersion: '1.1.0', published: true },
    { name: 'pkg-b', newVersion: '1.0.1', published: true },
  ]),
);

const simpleChangeset2 = {
  summary: 'This is a summary',
  releases: [
    { name: 'pkg-a', type: 'minor' },
    { name: 'pkg-b', type: 'patch' },
  ],
  dependents: [{ name: 'pkg-b', type: 'none', dependencies: [] }],
  commit: 'b8bb699',
};

const mockUnpublishedChangesetCommits = commits => {
  git.getUnpublishedChangesetCommits.mockImplementationOnce(() =>
    Promise.resolve(commits),
  );
};

describe('running release', () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, 'simple-project');
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = consoleError;
  });

  describe('When there is no changeset commits', () => {
    // we make sure we still do this so that a later build can clean up after a previously
    // failed one (where the change was pushed back but not released and the next build has no
    // changeset commits)
    it('should still run bolt.publishPackages', async () => {
      await runRelease({ cwd });

      expect(bolt.publishPackages).toHaveBeenCalled();
    });
  });

  describe('When there is a changeset commit', () => {
    it('should run bolt.publishPackages', async () => {
      mockUnpublishedChangesetCommits([simpleChangeset2]);

      await runRelease({ cwd });

      expect(bolt.publishPackages).toHaveBeenCalled();
    });

    it('should add git tags', async () => {
      mockUnpublishedChangesetCommits([simpleChangeset2]);

      await runRelease({ cwd });

      expect(git.tag).toHaveBeenCalledWith('pkg-a@1.1.0');
      expect(git.tag).toHaveBeenCalledWith('pkg-b@1.0.1');
    });
  });
});
