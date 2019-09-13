import { copyFixtureIntoTempDir } from "jest-fixtures";

import fs from "fs-extra";
import path from "path";
import versionCommand from "./index";
import * as git from "@changesets/git";
import logger from "../../utils/logger";
import writeChangeset from "../add/writeChangeset";
import { NewChangeset, Config } from "@changesets/types";
import { defaultConfig } from "@changesets/config";

let changelogPath = path.resolve(__dirname, "../../changelog");
let modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null]
};

// avoid polluting test logs with error message in console
// This is from bolt's error log
const consoleError = console.error;

jest.mock("../../utils/cli");
jest.mock("@changesets/git");
jest.mock("../../utils/logger");

// @ts-ignore
git.add.mockImplementation(() => Promise.resolve(true));
// @ts-ignore
git.commit.mockImplementation(() => Promise.resolve(true));
// @ts-ignore
git.tag.mockImplementation(() => Promise.resolve(true));

const simpleChangeset: NewChangeset = {
  summary: "This is a summary",
  releases: [{ name: "pkg-a", type: "minor" }],
  id: "having-lotsof-fun"
};

const simpleChangeset2: NewChangeset = {
  summary: "This is a summary too",
  releases: [
    { name: "pkg-a", type: "minor" },
    { name: "pkg-b", type: "patch" }
  ],
  id: "wouldnit-be-nice"
};

const writeChangesets = (changesets: NewChangeset[], cwd: string) => {
  return Promise.all(
    changesets.map(changeset => writeChangeset(changeset, cwd))
  );
};

const getPkgJSON = (pkgName: string, calls: any) => {
  let castCalls: [string, string][] = calls;
  const foundCall = castCalls.find(call =>
    call[0].endsWith(`${pkgName}/package.json`)
  );
  if (!foundCall)
    throw new Error(`could not find writing of package.json: ${pkgName}`);

  return JSON.parse(foundCall[1]);
};

const writeEmptyChangeset = (cwd: string) => writeChangesets([], cwd);

describe("running version in a simple project", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
    console.error = jest.fn();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    console.error = consoleError;
  });

  describe("when there are no changeset commits", () => {
    it("should warn if no changeset commits exist", async () => {
      await writeEmptyChangeset(cwd);
      await versionCommand(cwd, modifiedDefaultConfig);
      // @ts-ignore
      const loggerWarnCalls = logger.warn.mock.calls;
      expect(loggerWarnCalls.length).toEqual(1);
      expect(loggerWarnCalls[0][0]).toEqual(
        "No unreleased changesets found, exiting."
      );
    });
  });

  describe("When there is a changeset commit", () => {
    it("should bump releasedPackages", async () => {
      await writeChangesets([simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, "writeFile");

      await versionCommand(cwd, modifiedDefaultConfig);

      expect(getPkgJSON("pkg-a", spy.mock.calls)).toEqual(
        expect.objectContaining({ name: "pkg-a", version: "1.1.0" })
      );
      expect(getPkgJSON("pkg-b", spy.mock.calls)).toEqual(
        expect.objectContaining({ name: "pkg-b", version: "1.0.1" })
      );
    });
  });

  it("should bump packages to the correct versions when packages are linked", async () => {
    const cwd2 = await copyFixtureIntoTempDir(__dirname, "linked-packages");
    await writeChangesets([simpleChangeset2], cwd2);
    const spy = jest.spyOn(fs, "writeFile");

    await versionCommand(cwd2, {
      ...modifiedDefaultConfig,
      linked: [["pkg-a", "pkg-b"]]
    });

    expect(getPkgJSON("pkg-a", spy.mock.calls)).toEqual(
      expect.objectContaining({ name: "pkg-a", version: "1.1.0" })
    );
    expect(getPkgJSON("pkg-b", spy.mock.calls)).toEqual(
      expect.objectContaining({ name: "pkg-b", version: "1.1.0" })
    );
  });

  it("should not break when there is a linked package without a changeset", async () => {
    const cwd2 = await copyFixtureIntoTempDir(__dirname, "linked-packages");
    await writeChangesets([simpleChangeset], cwd2);
    const spy = jest.spyOn(fs, "writeFile");

    await versionCommand(cwd2, modifiedDefaultConfig);

    expect(getPkgJSON("pkg-a", spy.mock.calls)).toEqual(
      expect.objectContaining({ name: "pkg-a", version: "1.1.0" })
    );
  });

  describe("when there are multiple changeset commits", () => {
    it("should bump releasedPackages", async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, "writeFile");

      await versionCommand(cwd, modifiedDefaultConfig);

      expect(getPkgJSON("pkg-a", spy.mock.calls)).toEqual(
        expect.objectContaining({ name: "pkg-a", version: "1.1.0" })
      );
      expect(getPkgJSON("pkg-b", spy.mock.calls)).toEqual(
        expect.objectContaining({ name: "pkg-b", version: "1.0.1" })
      );
    });

    it("should bump multiple released packages if required", async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      const spy = jest.spyOn(fs, "writeFile");
      await versionCommand(cwd, modifiedDefaultConfig);

      // first call should be minor bump
      expect(getPkgJSON("pkg-a", spy.mock.calls)).toEqual(
        expect.objectContaining({
          name: "pkg-a",
          version: "1.1.0"
        })
      );
      // second should be a patch
      expect(getPkgJSON("pkg-b", spy.mock.calls)).toEqual(
        expect.objectContaining({
          name: "pkg-b",
          version: "1.0.1"
        })
      );
    });
    it("should delete the changeset files", async () => {
      await writeChangesets([simpleChangeset, simpleChangeset2], cwd);
      await versionCommand(cwd, modifiedDefaultConfig);

      const dirs = await fs.readdir(path.resolve(cwd, ".changeset"));
      expect(dirs.length).toBe(2);
    });
  });
});
