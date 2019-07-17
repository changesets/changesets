import { copyFixtureIntoTempDir } from "jest-fixtures";
import fs from "fs-extra";
import path from "path";

import writeChangeset from "../../add/writeChangeset";
import status from "..";

import humanId from "human-id";

jest.mock("human-id");

const simpleChangeset = {
  summary: "This is a summary",
  releases: [
    { name: "pkg-a", type: "minor" },
    { name: "pkg-b", type: "patch" }
  ],
  dependents: [{ name: "pkg-b", type: "none", dependencies: [] }]
};

const simpleReleaseObj = {
  releases: [
    {
      name: "pkg-a",
      type: "minor",
      changesets: ["ascii"],
      commits: [],
      version: "1.1.0"
    },
    {
      name: "pkg-b",
      type: "patch",
      changesets: ["ascii"],
      commits: [],
      version: "1.0.1"
    }
  ],
  deleted: [],
  changesets: [
    {
      summary: "This is a summary",
      commit: undefined,
      releases: [
        { name: "pkg-a", type: "minor" },
        { name: "pkg-b", type: "patch" }
      ],
      id: "ascii",
      dependents: [{ name: "pkg-b", type: "none", dependencies: [] }]
    }
  ]
};

jest.mock("../../../utils/logger");
jest.mock("@changesets/git");

const writeChangesets = (commits, cwd) => {
  return Promise.all(commits.map(commit => writeChangeset(commit, { cwd })));
};

describe("status", () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
  });

  it("should get the status for a simple changeset and return the release object", async () => {
    const changesetID = "ascii";
    humanId.mockReturnValueOnce(changesetID);

    await writeChangesets([simpleChangeset], cwd);
    const releaseObj = await status({ cwd });
    expect(releaseObj).toEqual(simpleReleaseObj);
  });
  it("should exit with a non-zero error code when there are no changesets", async () => {
    const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
    await status({ cwd });
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it.skip("should respect since master flag", () => false);
  it.skip("should respect the verbose flag", () => false);
  it("should respect the output flag", async () => {
    const output = "nonsense.json";

    const changesetID = "ascii";
    humanId.mockReturnValueOnce(changesetID);

    await writeChangesets([simpleChangeset], cwd);
    const probsUndefined = await status({ cwd, output });

    const releaseObj = await fs.readFile(path.join(cwd, output));

    expect(probsUndefined).toEqual(undefined);
    expect(JSON.parse(releaseObj)).toEqual(simpleReleaseObj);
  });
});
