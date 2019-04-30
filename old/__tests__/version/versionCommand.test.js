import { copyFixtureIntoTempDir } from 'jest-fixtures';

const path = require('path');
const versionCommand = require('../../version/versionCommand');
const git = require('@atlaskit/build-utils/git');
const fs = require('@atlaskit/build-utils/fs');
const logger = require('@atlaskit/build-utils/logger');
const writeChangeset = require('../../changeset/writeChangeset');
const getChangesetBase = require('../../utils/getChangesetBase');
const fse = require('fs-extra');

// avoid polluting test logs with error message in console
const consoleError = console.error;

jest.mock('@atlaskit/build-utils/cli');
jest.mock('@atlaskit/build-utils/git');
jest.mock('../../changeset/parseChangesetCommit');
jest.mock('@atlaskit/build-utils/logger');

git.add.mockImplementation(() => Promise.resolve(true));
git.commit.mockImplementation(() => Promise.resolve(true));
git.push.mockImplementation(() => Promise.resolve(true));
git.tag.mockImplementation(() => Promise.resolve(true));

const simpleChangeset = {
  summary: 'This is a summary',
  releases: [{ name: 'pkg-a', type: 'minor' }],
  dependents: [],
  commit: 'b8bb699',
};

const simpleChangeset2 = {
  summary: 'This is a summary',
  releases: [
    { name: 'pkg-a', type: 'minor' },
    { name: 'pkg-b', type: 'patch' },
  ],
  dependents: [{ name: 'pkg-b', type: 'none', dependencies: [] }],
  commit: 'b8bb699',
};

const writeEmptyChangeset = cwd => writeChangesets([], cwd);

const writeChangesets = (commits, cwd) => {
  return Promise.all(commits.map(commit => writeChangeset(commit, { cwd })));
};

describe('running version in a simple project', () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, 'simple-project');
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = consoleError;
  });

  describe('when there are no changeset commits', () => {
    it('should warn if no changeset commits exist', async () => {
      await writeEmptyChangeset(cwd);
      await versionCommand({ cwd });
      const loggerWarnCalls = logger.warn.mock.calls;
      expect(loggerWarnCalls.length).toEqual(1);
      expect(loggerWarnCalls[0][0]).toEqual(
        'No unreleased changesets found, exiting.',
      );
    });
  });

  describe('When there is a changeset commit', () => {
    it('should bump releasedPackages', async () => {
      const spy = jest.spyOn(fs, 'writeFile');
      await writeChangesets([simpleChangeset2], cwd);

      await versionCommand({ cwd });
      const calls = spy.mock.calls;

      expect(JSON.parse(calls[0][1])).toEqual(
        expect.objectContaining({ name: 'pkg-a', version: '1.1.0' }),
      );
      expect(JSON.parse(calls[1][1])).toEqual(
        expect.objectContaining({ name: 'pkg-b', version: '1.0.1' }),
      );
    });

    it('should git add the expected files (without changelog) when commit: true', async () => {
      await writeChangesets([simpleChangeset2], cwd);
      await versionCommand({ cwd, commit: true });

      const pkgAConfigPath = path.join(cwd, 'packages/pkg-a/package.json');
      const pkgBConfigPath = path.join(cwd, 'packages/pkg-b/package.json');
      const changesetConfigPath = path.join(cwd, '.changeset');

      expect(git.add).toHaveBeenCalledWith(pkgAConfigPath);
      expect(git.add).toHaveBeenCalledWith(pkgBConfigPath);
      expect(git.add).toHaveBeenCalledWith(changesetConfigPath);
    });
    it('should git add the expected files (with changelog)', async () => {
      await writeChangesets([simpleChangeset2], cwd);
      await versionCommand({ cwd, changelogs: true, commit: true });
      const pkgAChangelogPath = path.join(cwd, 'packages/pkg-a/CHANGELOG.md');
      const pkgBChangelogPath = path.join(cwd, 'packages/pkg-b/CHANGELOG.md');
      expect(git.add).toHaveBeenCalledWith(pkgAChangelogPath);
      expect(git.add).toHaveBeenCalledWith(pkgBChangelogPath);
    });
  });

  it('should respect config file', async () => {
    // We have used the atlaskit config. Its two differences are it has skipCI and commit as true
    let cwd2 = await copyFixtureIntoTempDir(
      __dirname,
      'simple-project-custom-config',
    );
    await writeChangesets([simpleChangeset2], cwd2);
    await versionCommand({ cwd: cwd2 });

    expect(git.commit).toHaveBeenCalledTimes(1);
  });

  describe('when there are multiple changeset commits', () => {
    it('should bump releasedPackages', async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, 'writeFile');

      await versionCommand({ cwd });
      const calls = spy.mock.calls;
      expect(JSON.parse(calls[0][1])).toEqual(
        expect.objectContaining({ name: 'pkg-a', version: '1.1.0' }),
      );
      expect(JSON.parse(calls[1][1])).toEqual(
        expect.objectContaining({ name: 'pkg-b', version: '1.0.1' }),
      );
    });

    it('should bump multiple released packages if required', async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, 'writeFile');
      await versionCommand({ cwd });
      const calls = spy.mock.calls;

      // first call should be minor bump
      expect(JSON.parse(calls[0][1])).toEqual(
        expect.objectContaining({
          name: 'pkg-a',
          version: '1.1.0',
        }),
      );
      // second should be a patch
      expect(JSON.parse(calls[1][1])).toEqual(
        expect.objectContaining({
          name: 'pkg-b',
          version: '1.0.1',
        }),
      );
    });
    it('should delete the changeset folders', async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      await versionCommand({ cwd });

      const dirs = await fse.readdir(path.resolve(cwd, '.changeset'));
      expect(dirs.length).toBe(1);
    });
  });
});
