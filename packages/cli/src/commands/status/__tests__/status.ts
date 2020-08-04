import fixtures from "fixturez";
import fs from "fs-extra";
import path from "path";
import { defaultConfig } from "@changesets/config";
import { temporarilySilenceLogs } from "@changesets/test-utils";
import writeChangeset from "@changesets/write";

import status from "..";

import humanId from "human-id";
import { NewChangeset, ReleasePlan } from "@changesets/types";

jest.mock("human-id");

const f = fixtures(__dirname);

const simpleChangeset: NewChangeset = {
  id: "fake-ids-abound",
  summary: "This is a summary",
  releases: [
    { name: "pkg-a", type: "minor" },
    { name: "pkg-b", type: "patch" }
  ]
};

const simpleReleasePlan: ReleasePlan = {
  releases: [
    {
      name: "pkg-a",
      type: "minor",
      changesets: ["ascii"],
      oldVersion: "1.0.0",
      newVersion: "1.1.0"
    },
    {
      name: "pkg-b",
      type: "patch",
      changesets: ["ascii"],
      oldVersion: "1.0.0",
      newVersion: "1.0.1"
    }
  ],
  changesets: [
    {
      summary: "This is a summary",
      releases: [
        { name: "pkg-a", type: "minor" },
        { name: "pkg-b", type: "patch" }
      ],
      id: "ascii"
    }
  ],
  preState: undefined
};

jest.mock("@changesets/git");

const writeChangesets = (changesets: NewChangeset[], cwd: string) => {
  return Promise.all(changesets.map(commit => writeChangeset(commit, cwd)));
};

describe("status", () => {
  temporarilySilenceLogs();
  let cwd: string;

  beforeEach(async () => {
    cwd = await f.copy("simple-project");
  });

  it("should get the status for a simple changeset and return the release object", async () => {
    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangesets([simpleChangeset], cwd);
    const releaseObj = await status(cwd, {}, defaultConfig);
    expect(releaseObj).toEqual(simpleReleasePlan);
  });
  it("should exit with a non-zero error code when there are no changesets", async () => {
    // @ts-ignore
    const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
    await status(cwd, {}, defaultConfig);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it.skip("should respect since master flag", () => false);
  it.skip("should respect the verbose flag", () => false);
  it("should respect the output flag", async () => {
    const output = "nonsense.json";

    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangesets([simpleChangeset], cwd);
    const probsUndefined = await status(cwd, { output }, defaultConfig);

    const releaseObj = await fs.readFile(path.join(cwd, output), "utf-8");

    expect(probsUndefined).toEqual(undefined);
    expect(JSON.parse(releaseObj)).toEqual(simpleReleasePlan);
  });
});
