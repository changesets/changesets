import { copyFixtureIntoTempDir } from 'jest-fixtures';
import path from 'path';
import fs from 'fs';
import updateChangelog from '../../changelog';
import { versionOptions } from '../../initialize/initial/config';

jest.mock('@atlaskit/build-utils/logger');

const emptyFileChangeset = {
  releases: [
    { name: 'has-empty-changelog', commits: ['b8bb699'], version: '1.1.0' },
  ],
  changesets: [
    {
      summary: 'This is a summary',
      releases: [{ name: 'has-empty-changelog', type: 'minor' }],
      dependents: [],
      commit: 'b8bb699',
    },
  ],
};

const noChangelogFileChangeset = {
  releases: [
    { name: 'has-no-changelog', commits: ['b8bb699'], version: '1.1.0' },
  ],
  changesets: [
    {
      summary: 'This is a summary',
      releases: [{ name: 'has-no-changelog', type: 'minor' }],
      dependents: [],
      commit: 'b8bb699',
    },
  ],
};
const filledChangelogContent = `# Has Empty Changelog

## 1.0.0
- [patch] This existed before [b8bb699](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/b8bb699)
- [minor] This also existed before [abcdefg](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/abcdefg)
`;

const hasFilledChangelogChangeset = {
  releases: [
    { name: 'has-filled-changelog', commits: ['b8bb699'], version: '1.1.0' },
  ],
  changesets: [
    {
      summary: 'This is a summary',
      releases: [{ name: 'has-filled-changelog', type: 'minor' }],
      dependents: [],
      commit: 'b8bb699',
    },
  ],
};

const multipleChangesets = {
  releases: [
    {
      name: 'has-empty-changelog',
      commits: ['b8bb699', 'abcdefg'],
      version: '1.1.0',
    },
  ],
  changesets: [
    {
      summary: 'This is a summary',
      releases: [{ name: 'has-empty-changelog', type: 'patch' }],
      dependents: [],
      commit: 'b8bb699',
    },
    {
      summary: 'This is a second summary',
      releases: [{ name: 'has-empty-changelog', type: 'minor' }],
      dependents: [],
      commit: 'abcdefg',
    },
  ],
};

const multipleReleaseObj = {
  releases: [
    { name: 'has-empty-changelog', commits: ['b8bb699'], version: '1.1.0' },
    { name: 'has-filled-changelog', commits: ['b8bb699'], version: '1.0.1' },
  ],
  changesets: [
    {
      summary: 'This is a summary',
      releases: [
        { name: 'has-empty-changelog', type: 'minor' },
        { name: 'has-filled-changelog', type: 'patch' },
      ],
      dependents: [],
      commit: 'b8bb699',
    },
  ],
};

describe('updateChangelog', async () => {
  let cwd, emptyChangelogPath, existingChangelogPath, noChangelogPath;
  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(
      __dirname,
      'simple-project-with-changelogs',
    );
    emptyChangelogPath = path.join(
      cwd,
      'packages',
      'has-empty-changelog',
      'CHANGELOG.md',
    );
    existingChangelogPath = path.join(
      cwd,
      'packages',
      'has-filled-changelog',
      'CHANGELOG.md',
    );
    noChangelogPath = path.join(
      cwd,
      'packages',
      'has-no-changelog',
      'CHANGELOG.md',
    );
  });

  it('should work with empty changelog', async () => {
    const initalChangelog = fs.readFileSync(emptyChangelogPath).toString();
    expect(initalChangelog).toEqual('');
    await updateChangelog(emptyFileChangeset, { ...versionOptions, cwd });

    const updatedChangelog = fs.readFileSync(emptyChangelogPath).toString();
    expect(updatedChangelog).toEqual(`# has-empty-changelog

## 1.1.0
- [minor] b8bb699:

  This is a summary
`);
  });
  it('should work with multiple changesets', async () => {
    const initalChangelog = fs.readFileSync(emptyChangelogPath).toString();
    expect(initalChangelog).toEqual('');
    await updateChangelog(multipleChangesets, { ...versionOptions, cwd });

    const updatedChangelog = fs.readFileSync(emptyChangelogPath).toString();
    expect(updatedChangelog).toEqual(`# has-empty-changelog

## 1.1.0
- [patch] b8bb699:

  This is a summary
- [minor] abcdefg:

  This is a second summary
`);
  });
  it('should work for multiple packages', async () => {
    const initalChangelog = fs.readFileSync(emptyChangelogPath).toString();
    const existingInitial = fs.readFileSync(existingChangelogPath).toString();
    expect(initalChangelog).toEqual('');
    expect(existingInitial).toEqual(filledChangelogContent);
    await updateChangelog(multipleReleaseObj, { ...versionOptions, cwd });

    const updatedChangelog = fs.readFileSync(emptyChangelogPath).toString();
    const updatedExistingChangelog = fs
      .readFileSync(existingChangelogPath)
      .toString();
    expect(updatedChangelog).toEqual(`# has-empty-changelog

## 1.1.0
- [minor] b8bb699:

  This is a summary
`);
    expect(updatedExistingChangelog).toEqual(`# Has Empty Changelog

## 1.0.1
- [patch] b8bb699:

  This is a summary

## 1.0.0
- [patch] This existed before [b8bb699](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/b8bb699)
- [minor] This also existed before [abcdefg](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/abcdefg)
`);
  });
  it('should return the updated file paths', async () => {
    const updatedPackages = await updateChangelog(multipleReleaseObj, {
      ...versionOptions,
      cwd,
    });
    expect(updatedPackages).toEqual([
      emptyChangelogPath,
      existingChangelogPath,
    ]);
  });
  it('has no changelog file', async () => {
    const changelogExists = fs.existsSync(noChangelogPath);
    expect(changelogExists).toEqual(false);
    await updateChangelog(noChangelogFileChangeset, { ...versionOptions, cwd });

    const updatedChangelog = fs.readFileSync(noChangelogPath).toString();
    expect(updatedChangelog).toEqual(`# has-no-changelog

## 1.1.0
- [minor] b8bb699:

  This is a summary
`);
  });
  it('should work with an existing changelog', async () => {
    const initalChangelog = fs.readFileSync(existingChangelogPath).toString();

    expect(initalChangelog).toEqual(filledChangelogContent);
    await updateChangelog(hasFilledChangelogChangeset, {
      ...versionOptions,
      cwd,
    });

    const updatedChangelog = fs.readFileSync(existingChangelogPath).toString();
    expect(updatedChangelog).toEqual(`# Has Empty Changelog

## 1.1.0
- [minor] b8bb699:

  This is a summary

## 1.0.0
- [patch] This existed before [b8bb699](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/b8bb699)
- [minor] This also existed before [abcdefg](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/abcdefg)
`);
  });
});
