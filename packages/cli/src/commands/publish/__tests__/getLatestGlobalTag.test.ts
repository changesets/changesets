import fs from "fs-extra";
import path from "path";
import { copyFixtureIntoTempDir } from "jest-fixtures";

import getLatestGlobalTag from "../getLatestGlobalTag";

describe("get latest global tag", () => {
  it("should read a tag when the file is found", async () => {
    let cwd = await copyFixtureIntoTempDir(
      __dirname,
      "simple-project-with-release-notes"
    );

    let tag = await getLatestGlobalTag(cwd, "RELEASE_NOTES.md");
    expect(tag).toEqual("latest-tag-here");
  });
  it("should return false when no tag can be found in the file", async () => {
    let cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");

    await fs.writeFile(path.join(cwd, "RELEASE_NOTES.md"), "# U wot mate?");
    let tag = await getLatestGlobalTag(cwd, "RELEASE_NOTES.md");
    expect(tag).toEqual(false);
  });
  it("should return false when the file is missing", async () => {
    let cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");

    let tag = await getLatestGlobalTag(cwd, "RELEASE_NOTES.md");
    expect(tag).toEqual(false);
  });
});
