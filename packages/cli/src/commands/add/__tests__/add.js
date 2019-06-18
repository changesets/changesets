// @flow
import { copyFixtureIntoTempDir } from "jest-fixtures";
import path from "path";
import fs from "fs-extra";

import stripAnsi from "strip-ansi";
import { askCheckboxPlus, askConfirm, askQuestion } from "../../../utils/cli";
import * as git from "@changesets/git";

import addChangeset from "..";
import writeChangeset from "../writeChangeset";

jest.mock("../../../utils/logger");
jest.mock("../../../utils/cli");
jest.mock("@changesets/git");
jest.mock("../writeChangeset");
writeChangeset.mockImplementation(() => Promise.resolve("abcdefg"));
git.commit.mockImplementation(() => Promise.resolve(true));

// This is some sad flow hackery
const unsafeGetChangedPackagesSinceMaster = git.getChangedPackagesSinceMaster;
unsafeGetChangedPackagesSinceMaster.mockReturnValue([]);

// type releases = {
//   [string]: string
// };
// type dependent = {
//   name: string,
//   type: string,
//   dependencies: Array<string>
// };
// type mockResponses = {
//   summary?: string,
//   shouldCommit?: string,
//   releases: releases,
//   dependents?: Array<dependent>
// };

const mockUserResponses = mockResponses => {
  const summary = mockResponses.summary || "summary message mock";
  let majorReleases = [];
  let minorReleases = [];
  Object.entries(mockResponses.releases).forEach(([pkgName, type]) => {
    if (type === "major") {
      majorReleases.push(pkgName);
    } else if (type === "minor") {
      minorReleases.push(pkgName);
    }
  });
  let callCount = 0;
  let returnValues = [
    Object.keys(mockResponses.releases),
    majorReleases,
    minorReleases
  ];
  askCheckboxPlus.mockImplementation(() => {
    if (callCount === returnValues.length) {
      throw new Error(`There was an unexpected call to askCheckboxPlus`);
    }
    return returnValues[callCount++];
  });

  let confirmAnswers = {
    "Is this your desired changeset?": true
  };

  askQuestion.mockReturnValueOnce(summary);
  askConfirm.mockImplementation(question => {
    question = stripAnsi(question);
    if (confirmAnswers[question]) {
      return confirmAnswers[question];
    }
    throw new Error(`An answer could not be found for ${question}`);
  });
};

describe("Changesets", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should generate changeset to patch a single package", async () => {
    const cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "pkg-a", type: "patch" }]
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it("should commit when the commit flag is passed in", async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "simple-project-custom-config"
    );

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd, commit: true });
    expect(git.add).toHaveBeenCalledTimes(1);
  });
  it("should clean up empty folders", async () => {
    const cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");

    const emptyDirPath = path.join(cwd, ".changeset/empty-dir");
    expect(fs.pathExistsSync(emptyDirPath)).toBe(false);
    await fs.mkdir(emptyDirPath);
    expect(fs.pathExistsSync(emptyDirPath)).toBe(true);

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    expect(fs.pathExistsSync(emptyDirPath)).toBe(false);
  });
});
