import { copyFixtureIntoTempDir } from "jest-fixtures";
import { ReleasePlan, Config } from "@changesets/types";
import fs from "fs-extra";
import outdent from "outdent";

import applyReleasePlan from "./";

async function testSetup(
  fixtureName: string,
  releasePlan: ReleasePlan,
  config?: Config
) {
  let tempDir = await copyFixtureIntoTempDir(__dirname, fixtureName);
  return applyReleasePlan(releasePlan, tempDir, config);
}

let simpleFakePlan: ReleasePlan = {
  changesets: [
    {
      id: "quick-lions-devour",
      summary: "Hey, let's have fun with testing!",
      releases: [{ name: "pkg-a", type: "minor" }]
    }
  ],
  releases: [
    {
      name: "pkg-a",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: ["quick-lions-devour"]
    }
  ]
};

describe("apply release plan", () => {
  describe("versioning", () => {
    it("should update a version for one package", async () => {
      let changedFiles = await testSetup("simple-project", simpleFakePlan);

      let pkgPath = changedFiles.find(a => a.endsWith("pkg-a/package.json"));

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toMatchObject({
        name: "pkg-a",
        version: "1.1.0"
      });
    });
    it("should update a version for five packages with different new versions", () => {});
  });
  describe("changelogs", () => {
    it.skip("should update a changelog for one package", async () => {
      let changedFiles = await testSetup("simple-project", simpleFakePlan);

      let readmePath = changedFiles.find(a => a.endsWith("pkg-a/CHANGELOG.md"));

      console.log(changedFiles);

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");

      expect(readme).toEqual(outdent`
      # pkg-a

      ## 1.1.0

      - Hey, let's have fun with testing!
      `);
    });
    it("should update a changelog for five packages", () => {});
  });
  describe("should error and not write if", () => {
    it("a package appears twice", () => {});
    it("a package cannot be found", () => {});
    it("a provided changelog function fails", () => {});
    it("a changelog write fails", () => {});
    it("a changelog write fails", () => {});
  });
  describe("changesets", () => {
    it("should delete one changeset after it is applied", () => {});
    it("should delete five changesets after they are applied", () => {});
  });
  describe("git", () => {
    it("should commit updating files from packages", () => {});
    it("should commit removing applied changesets", () => {});
  });
});
