import { copyFixtureIntoTempDir } from "jest-fixtures";

import fs from "fs-extra";
import path from "path";
import outdent from "outdent";
import writeChangeset from "../writeChangeset";

import humanId from "human-id";

jest.mock("human-id");

const simpleChangeset = {
  summary: "This is a summary",
  releases: [{ name: "pkg-a", type: "minor" }],
  dependents: []
};

describe("simple project", () => {
  let cwd;

  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it("should write a changeset", async () => {
    const changesetID = "ascii";
    humanId.mockReturnValueOnce(changesetID);

    await writeChangeset(simpleChangeset, { cwd });

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);

    const mdContent = await fs.readFile(mdPath, "utf-8");

    const correctSummary = outdent`---
    "pkg-a": minor
    ---

    This is a summary

    `;

    expect(mdContent).toBe(correctSummary);
  });
  it("should clean up empty folders", async () => {
    const changesetID = "ascii";
    humanId.mockReturnValueOnce(changesetID);

    const emptyDirPath = path.join(cwd, ".changeset/empty-dir");

    await fs.mkdir(emptyDirPath);
    await writeChangeset(simpleChangeset, { cwd });

    expect(fs.pathExistsSync(emptyDirPath)).toBe(false);
  });
  it("should leave folders with contents", async () => {
    const changesetID = "ascii";
    humanId.mockReturnValueOnce(changesetID);

    const fullFilePath = path.join(cwd, ".changeset/full-dir/changes.md");

    await fs.ensureFile(fullFilePath);
    await writeChangeset(simpleChangeset, { cwd });

    expect(fs.pathExistsSync(fullFilePath)).toBe(true);
  });
});
