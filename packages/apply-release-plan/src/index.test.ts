import { copyFixtureIntoTempDir } from "jest-fixtures";
import applyReleasePlan from "./";
import { ReleasePlan, Config } from "@changesets/types";

async function testSetup(
  fixtureName: string,
  releasePlan: ReleasePlan,
  config: Config
) {
  let tempDir = await copyFixtureIntoTempDir(__dirname, fixtureName);
  return applyReleasePlan(releasePlan, tempDir, config);
}

function fakeReleasePlan(changesets = [], releases = []): ReleasePlan {
  return {
    changesets,
    releases
  };
}

describe("apply release plan", () => {
  describe("versioning", () => {
    it("should update a version for one package", async () => {
      let changedFiles = await testSetup(
        "simple-project",
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "pkg-a", type: "minor" }]
            }
          ],
          releases: []
        },
        {}
      );

      expect(changedFiles.length).toEqual(3);
    });
    it("should update a version for five packages with different new versions", () => {});
  });
  describe("changelogs", () => {
    it("should update a changelog for one package", () => {});
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
