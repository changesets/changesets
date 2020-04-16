import { Config } from "@changesets/types";
import { copyFixtureIntoTempDir } from "jest-fixtures";
import { defaultConfig } from "@changesets/config";
import writeChangeset from "@changesets/write";

import path from "path";

import generateReleaseNotes from ".";

let changelogPath = path.resolve(__dirname, "../../cli/changelog");
let modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null]
};

describe("generate-release-notes", () => {
  it("should generate basic release notes", async () => {
    let cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
    await writeChangeset(
      {
        summary: "basic summary let us see",
        releases: [{ name: "pkg-a", type: "patch" }]
      },
      cwd
    );

    let releasePlan = await generateReleaseNotes(cwd, modifiedDefaultConfig);
    console.log(releasePlan);

    expect(true).toBeFalsy();
  });
});
