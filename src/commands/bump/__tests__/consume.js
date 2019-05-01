import { copyFixtureIntoTempDir } from "jest-fixtures";

import fs from "fs-extra";
import path from "path";
import versionCommand from "../index";
import * as git from "../../../utils/git";
import logger from "../../../utils/logger";
import writeChangeset from "../../add/writeChangeset";

// avoid polluting test logs with error message in console
// This is from bolt's error log
const consoleError = console.error;

jest.mock("../../../utils/cli");
jest.mock("../../../utils/git");
jest.mock("../../add/parseChangesetCommit");
jest.mock("../../../utils/logger");

git.add.mockImplementation(() => Promise.resolve(true));
git.commit.mockImplementation(() => Promise.resolve(true));
git.tag.mockImplementation(() => Promise.resolve(true));

const simpleChangeset = {
  summary: "This is a summary",
  releases: [{ name: "pkg-a", type: "minor" }],
  dependents: [],
  commit: "b8bb699"
};

const simpleChangeset2 = {
  summary: "This is a summary",
  releases: [
    { name: "pkg-a", type: "minor" },
    { name: "pkg-b", type: "patch" }
  ],
  dependents: [{ name: "pkg-b", type: "none", dependencies: [] }],
  commit: "b8bb699"
};

const writeChangesets = (commits, cwd) => {
  return Promise.all(commits.map(commit => writeChangeset(commit, { cwd })));
};

const writeEmptyChangeset = cwd => writeChangesets([], cwd);

describe("running version in a simple project", () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = consoleError;
  });

  describe("when there are no changeset commits", () => {
    it("should warn if no changeset commits exist", async () => {
      await writeEmptyChangeset(cwd);
      await versionCommand({ cwd });
      const loggerWarnCalls = logger.warn.mock.calls;
      expect(loggerWarnCalls.length).toEqual(1);
      expect(loggerWarnCalls[0][0]).toEqual(
        "No unreleased changesets found, exiting."
      );
    });
  });

  describe("When there is a changeset commit", () => {
    it("should bump releasedPackages", async () => {
      const spy = jest.spyOn(fs, "writeFile");
      await writeChangesets([simpleChangeset2], cwd);

      await versionCommand({ cwd });
      const calls = spy.mock.calls;

      expect(JSON.parse(calls[0][1])).toEqual(
        expect.objectContaining({ name: "pkg-a", version: "1.1.0" })
      );
      expect(JSON.parse(calls[1][1])).toEqual(
        expect.objectContaining({ name: "pkg-b", version: "1.0.1" })
      );
    });

    it("should git add the expected files (without changelog) when commit: true", async () => {
      await writeChangesets([simpleChangeset2], cwd);
      await versionCommand({ cwd, commit: true });

      const pkgAConfigPath = path.join(cwd, "packages/pkg-a/package.json");
      const pkgBConfigPath = path.join(cwd, "packages/pkg-b/package.json");
      const changesetConfigPath = path.join(cwd, ".changeset");

      expect(git.add).toHaveBeenCalledWith(pkgAConfigPath);
      expect(git.add).toHaveBeenCalledWith(pkgBConfigPath);
      expect(git.add).toHaveBeenCalledWith(changesetConfigPath);
    });
    it("should git add the expected files (with changelog)", async () => {
      await writeChangesets([simpleChangeset2], cwd);
      await versionCommand({ cwd, changelogs: true, commit: true });
      const pkgAChangelogPath = path.join(cwd, "packages/pkg-a/CHANGELOG.md");
      const pkgBChangelogPath = path.join(cwd, "packages/pkg-b/CHANGELOG.md");
      expect(git.add).toHaveBeenCalledWith(pkgAChangelogPath);
      expect(git.add).toHaveBeenCalledWith(pkgBChangelogPath);
    });
  });

  it("should respect config file", async () => {
    // We have used the atlaskit config. Its two differences are it has skipCI and commit as true
    const cwd2 = await copyFixtureIntoTempDir(
      __dirname,
      "simple-project-custom-config"
    );
    await writeChangesets([simpleChangeset2], cwd2);
    await versionCommand({ cwd: cwd2 });

    expect(git.commit).toHaveBeenCalledTimes(1);
  });

  describe("when there are multiple changeset commits", () => {
    it("should bump releasedPackages", async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, "writeFile");

      await versionCommand({ cwd });
      const calls = spy.mock.calls;
      expect(JSON.parse(calls[0][1])).toEqual(
        expect.objectContaining({ name: "pkg-a", version: "1.1.0" })
      );
      expect(JSON.parse(calls[1][1])).toEqual(
        expect.objectContaining({ name: "pkg-b", version: "1.0.1" })
      );
    });

    it("should bump multiple released packages if required", async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, "writeFile");
      await versionCommand({ cwd });
      const calls = spy.mock.calls;

      // first call should be minor bump
      expect(JSON.parse(calls[0][1])).toEqual(
        expect.objectContaining({
          name: "pkg-a",
          version: "1.1.0"
        })
      );
      // second should be a patch
      expect(JSON.parse(calls[1][1])).toEqual(
        expect.objectContaining({
          name: "pkg-b",
          version: "1.0.1"
        })
      );
    });
    it("should delete the changeset folders", async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      await versionCommand({ cwd });

      const dirs = await fs.readdir(path.resolve(cwd, ".changeset"));
      expect(dirs.length).toBe(1);
    });
  });
});
