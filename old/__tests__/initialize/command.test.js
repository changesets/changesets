import { copyFixtureIntoTempDir } from 'jest-fixtures';
import fs from 'fs-extra';
import path from 'path';

import { initializeCommand } from '../../initialize';
import resolveConfig from '../../utils/resolveConfig';

const consoleLog = console.log;

const getPaths = cwd => ({
  readmePath: path.join(cwd, '.changeset/README.md'),
  configPath: path.join(cwd, '.changeset/config.js'),
});

describe('Initialize', () => {
  beforeEach(() => {
    console.log = jest.fn();
  });
  afterEach(() => {
    jest.clearAllMocks();
    console.log = consoleLog;
  });
  it('should initialize in a project without a .changeset folder', async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      'without-existing-changeset',
    );
    const { readmePath, configPath } = getPaths(cwd);

    expect(fs.pathExistsSync(readmePath)).toBe(false);
    expect(fs.pathExistsSync(configPath)).toBe(false);
    await initializeCommand({ cwd });
    expect(fs.pathExistsSync(readmePath)).toBe(true);
    expect(fs.pathExistsSync(configPath)).toBe(true);
  });
  it('should fail in a project with a .changeset folder', async () => {
    const cwd = await copyFixtureIntoTempDir(__dirname, 'simple-project');
    expect(fs.pathExistsSync(path.join(cwd, '.changeset/README.md'))).toBe(
      true,
    );
    await initializeCommand({ cwd });
    expect(fs.pathExistsSync(path.join(cwd, '.changeset/config.js'))).toBe(
      false,
    );
  });
});
