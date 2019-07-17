// @flow
import { copyFixtureIntoTempDir } from "jest-fixtures";
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
      releases: [{ name: "pkg-a", type: "patch" }],
      dependents: []
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it("should patch a single pinned dependent", async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "pinned-caret-tilde-dependents"
    );
    mockUserResponses({ releases: { "depended-upon": "patch" } });
    await addChangeset({ cwd });

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "depended-upon", type: "patch" }],
      dependents: [
        { name: "pinned-dep", type: "patch", dependencies: ["depended-upon"] }
      ]
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it("should patch pinned and tilde dependents when minor bumping", async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "pinned-caret-tilde-dependents"
    );
    mockUserResponses({ releases: { "depended-upon": "minor" } });
    await addChangeset({ cwd });

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "depended-upon", type: "minor" }],
      dependents: [
        { name: "pinned-dep", type: "patch", dependencies: ["depended-upon"] },
        { name: "tilde-dep", type: "patch", dependencies: ["depended-upon"] }
      ]
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it("should patch pinned, tilde and caret deps when major bumping", async () => {
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "pinned-caret-tilde-dependents"
    );
    mockUserResponses({ releases: { "depended-upon": "major" } });
    await addChangeset({ cwd });

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "depended-upon", type: "major" }],
      dependents: [
        { name: "caret-dep", type: "patch", dependencies: ["depended-upon"] },
        { name: "pinned-dep", type: "patch", dependencies: ["depended-upon"] },
        { name: "tilde-dep", type: "patch", dependencies: ["depended-upon"] }
      ]
    };
    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it("should patch a transitively bumped dependent that leaves range", async () => {
    // Here we have a project where b -> a and c -> b, all pinned, so bumping a should bump b and c
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "simplest-transitive-dependents"
    );
    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "pkg-a", type: "patch" }],
      dependents: [
        { name: "pkg-b", type: "patch", dependencies: ["pkg-a"] },
        { name: "pkg-c", type: "patch", dependencies: ["pkg-b"] }
      ]
    };

    const call = writeChangeset.mock.calls[0][0];
    expect(call).toEqual(expectedChangeset);
  });

  it("should patch a previously checked transitive dependent", async () => {
    // Here we use project where b->a (caret) and c->a (pinned) and b -> c (pinned)
    // Therefore bumping a will bump c (but not b), but bumping c will bump b anyway
    const cwd = await copyFixtureIntoTempDir(
      __dirname,
      "previously-checked-transitive-dependent"
    );
    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    const expectedChangeset = {
      summary: "summary message mock",
      releases: [{ name: "pkg-a", type: "patch" }],
      dependents: [
        { name: "pkg-c", type: "patch", dependencies: ["pkg-a"] },
        { name: "pkg-b", type: "patch", dependencies: ["pkg-c", "pkg-a"] }
      ]
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
});
