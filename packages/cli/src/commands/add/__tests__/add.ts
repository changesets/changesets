import { copyFixtureIntoTempDir } from "jest-fixtures";
import stripAnsi from "strip-ansi";
import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import { temporarilySilenceLogs } from "@changesets/test-utils";

import { askCheckboxPlus, askConfirm, askQuestion } from "../../../utils/cli";
import addChangeset from "..";
import writeChangeset from "../writeChangeset";

jest.mock("../../../utils/cli");
jest.mock("@changesets/git");
jest.mock("../writeChangeset");
// @ts-ignore
writeChangeset.mockImplementation(() => Promise.resolve("abcdefg"));
// @ts-ignore
git.commit.mockImplementation(() => Promise.resolve(true));

// @ts-ignore
git.getChangedPackagesSinceRef.mockImplementation(({ ref }) => {
  expect(ref).toBe("master");
  return [];
});

// @ts-ignore
const mockUserResponses = mockResponses => {
  const summary = mockResponses.summary || "summary message mock";
  let majorReleases: Array<string> = [];
  let minorReleases: Array<string> = [];
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
  // @ts-ignore
  askCheckboxPlus.mockImplementation(() => {
    if (callCount === returnValues.length) {
      throw new Error(`There was an unexpected call to askCheckboxPlus`);
    }
    return returnValues[callCount++];
  });

  let confirmAnswers = {
    "Is this your desired changeset?": true
  };
  // @ts-ignore
  askQuestion.mockReturnValueOnce(summary);
  // @ts-ignore
  askConfirm.mockImplementation(question => {
    question = stripAnsi(question);
    // @ts-ignore
    if (confirmAnswers[question]) {
      // @ts-ignore
      return confirmAnswers[question];
    }
    throw new Error(`An answer could not be found for ${question}`);
  });
};

describe("Changesets", () => {
  temporarilySilenceLogs();

  it("should generate changeset to patch a single package", async () => {
    const cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset(cwd, { empty: false }, defaultConfig);

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "pkg-a", type: "patch" }]
    };
    // @ts-ignore
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });
  it("should commit when the commit flag is passed in", async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "simple-project-custom-config"
    );

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset(
      cwd,
      { empty: false },
      { ...defaultConfig, commit: true }
    );
    expect(git.add).toHaveBeenCalledTimes(1);
  });
  it("should create empty changeset when empty flag is passed in", async () => {
    const cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");

    await addChangeset(cwd, { empty: true }, defaultConfig);

    const expectedChangeset = {
      releases: [],
      summary: ""
    };
    // @ts-ignore
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });
});
