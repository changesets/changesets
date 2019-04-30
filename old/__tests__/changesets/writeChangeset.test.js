import { copyFixtureIntoTempDir } from 'jest-fixtures';

const fs = require('fs-extra');
const path = require('path');
const writeChangeset = require('../../changeset/writeChangeset');

// avoid polluting test logs with error message in console
const consoleError = console.error;

const simpleChangeset = {
  summary: 'This is a summary',
  releases: [{ name: 'pkg-a', type: 'minor' }],
  dependents: [],
};

describe('simple project', () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, 'simple-project');
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = consoleError;
  });
  it('should write a changeset', async () => {
    const changesetID = await writeChangeset(simpleChangeset, { cwd });

    const mdPath = path.join(cwd, '.changeset', changesetID, 'changes.md');
    const jsonPath = path.join(cwd, '.changeset', changesetID, 'changes.json');

    const json = require(jsonPath);
    const mdContent = await fs.readFile(mdPath, 'utf-8');

    const { summary, ...rest } = simpleChangeset;

    expect(mdContent).toBe(`- ${summary}`);
    expect(json).toEqual(rest);
  });
  it('should clean up empty folders', async () => {
    const emptyDirPath = path.join(cwd, '.changeset/empty-dir');

    await fs.mkdir(emptyDirPath);
    await writeChangeset(simpleChangeset, { cwd });

    expect(fs.pathExistsSync(emptyDirPath)).toBe(false);
  });
  it('should leave folders with contents', async () => {
    const fullFilePath = path.join(cwd, '.changeset/full-dir/changes.md');

    await fs.ensureFile(fullFilePath);
    await writeChangeset(simpleChangeset, { cwd });

    expect(fs.pathExistsSync(fullFilePath)).toBe(true);
  });
  it('should not write the same changeset twice', async () => {
    let message;
    await writeChangeset(simpleChangeset, { cwd });
    try {
      await writeChangeset(simpleChangeset, { cwd });
    } catch (e) {
      message = e.message;
    }
    expect(message).toBe(
      'A changeset with the unique ID 2b479644 already exists',
    );
  });
});
