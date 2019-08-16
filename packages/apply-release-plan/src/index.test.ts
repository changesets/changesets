import { copyFixtureIntoTempDir } from "jest-fixtures";
import {
  ReleasePlan,
  Config,
  NewChangeset,
  ComprehensiveRelease
} from "@changesets/types";
import * as git from "@changesets/git";
import fs from "fs-extra";
import path from "path";
import outdent from "outdent";
import spawn from "spawndamnit";

import applyReleasePlan from "./";
import createReleaseCommit from "./createVersionCommit";

class FakeReleasePlan {
  changesets: NewChangeset[];
  releases: ComprehensiveRelease[];
  baseChangeset: NewChangeset;
  baseRelease: ComprehensiveRelease;
  config: Config;

  constructor(
    changesets: NewChangeset[] = [],
    releases: ComprehensiveRelease[] = []
  ) {
    this.baseChangeset = {
      id: "quick-lions-devour",
      summary: "Hey, let's have fun with testing!",
      releases: [{ name: "pkg-a", type: "minor" }]
    };
    this.baseRelease = {
      name: "pkg-a",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: ["quick-lions-devour"]
    };
    this.config = {
      changelog: false,
      commit: false,
      linked: [],
      access: "private"
    };

    this.changesets = [this.baseChangeset, ...changesets];
    this.releases = [this.baseRelease, ...releases];
  }

  getReleasePlan(): ReleasePlan {
    return {
      changesets: this.changesets,
      releases: this.releases
    };
  }
}

async function testSetup(
  fixtureName: string,
  releasePlan: ReleasePlan,
  config?: Config
) {
  if (!config)
    config = {
      changelog: false,
      commit: false,
      linked: [],
      access: "private"
    };

  let tempDir = await copyFixtureIntoTempDir(__dirname, fixtureName);

  if (config.commit) {
    await git.add(".", tempDir);
    await git.commit("first commit", tempDir);
  }

  return {
    changedFiles: await applyReleasePlan(releasePlan, tempDir, config),
    tempDir
  };
}

describe("apply release plan", () => {
  describe("versioning", () => {
    it("should update a version for one package", async () => {
      const releasePlan = new FakeReleasePlan();
      let { changedFiles } = await testSetup(
        "simple-project",
        releasePlan.getReleasePlan(),
        releasePlan.config
      );
      let pkgPath = changedFiles.find(a => a.endsWith("pkg-a/package.json"));

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      let pkgJSON = await fs.readJSON(pkgPath);

      expect(pkgJSON).toMatchObject({
        name: "pkg-a",
        version: "1.1.0"
      });
    });
    it.skip("should update a version for five packages with different new versions", () => {});
  });
  describe("changelogs", () => {
    it("should update a changelog for one package", async () => {
      const releasePlan = new FakeReleasePlan();
      let { changedFiles } = await testSetup(
        "simple-project",
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [
            path.resolve(__dirname, "test-utils/simple-get-changelog-entry"),
            null
          ]
        }
      );

      let readmePath = changedFiles.find(a => a.endsWith("pkg-a/CHANGELOG.md"));

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      let readme = await fs.readFile(readmePath, "utf-8");

      expect(readme.trim()).toEqual(outdent`# pkg-a

      ## 1.1.0
      ### Minor Changes

      - Hey, let's have fun with testing!`);
    });
    it.skip("should update a changelog for five packages", () => {});
  });
  describe.skip("should error and not write if", () => {
    // This is skipped as *for now* we are assuming we have been passed
    // valid releasePlans - this may get work done on it in the future
    it.skip("a package appears twice", async () => {
      let changedFiles;
      try {
        let testResults = await testSetup("simple-project", {
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
            },
            {
              name: "pkg-a",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"]
            }
          ]
        });
        changedFiles = testResults.changedFiles;
      } catch (e) {
        expect(e.message).toEqual("some string probably");

        return;
      }

      throw new Error(
        `expected error but instead got changed files: \n${changedFiles.join(
          "\n"
        )}`
      );
    });
    it("a package cannot be found", async () => {
      let releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "impossible-package",
            type: "minor",
            oldVersion: "1.0.0",
            newVersion: "1.0.0",
            changesets: []
          }
        ]
      );
      let changedFiles;
      try {
        let testResults = await testSetup(
          "simple-project",
          releasePlan.getReleasePlan(),
          releasePlan.config
        );
        changedFiles = testResults.changedFiles;
      } catch (e) {
        expect(e.message).toEqual(
          "Could not find matching package for release of: impossible-package"
        );
        return;
      }

      throw new Error(
        `Expected test to exit before this point but instead got changedFiles ${changedFiles}`
      );
    });
    it.skip("a provided changelog function fails", async () => {
      throw new Error("test not written");
    });
    it.skip("a changelog write fails", async () => {
      throw new Error("test not written");
    });
  });
  describe.skip("changesets", () => {
    it("should delete one changeset after it is applied", () => {});
    it("should delete five changesets after they are applied", () => {});
  });
  describe("git", () => {
    it("should commit updating files from packages", async () => {
      const releasePlan = new FakeReleasePlan();

      let { tempDir } = await testSetup(
        "with-git",
        releasePlan.getReleasePlan(),
        { ...releasePlan.config, commit: true }
      );

      let gitCmd = await spawn("git", ["status"], { cwd: tempDir });

      expect(
        gitCmd.stdout
          .toString()
          .includes("nothing to commit, working tree clean")
      ).toBe(true);

      let lastCommit = await spawn("git", ["log", "-1"], { cwd: tempDir });

      lastCommit.stdout.toString();

      console.log(lastCommit.stdout.toString());
      console.log(createReleaseCommit(releasePlan.getReleasePlan(), true));

      expect(
        lastCommit.stdout
          .toString()
          .includes("RELEASING: Releasing 1 package(s)")
      ).toBe(true);
    });
    it("should commit removing applied changesets", () => {});
  });
});

// MAKE SURE BOTH OF THESE ARE COVERED

// it("should git add the expected files (without changelog) when commit: true", async () => {
//   await writeChangesets([simpleChangeset2], cwd);
//   await versionCommand(cwd, { ...modifiedDefaultConfig, commit: true });

//   const pkgAConfigPath = path.join(cwd, "packages/pkg-a/package.json");
//   const pkgBConfigPath = path.join(cwd, "packages/pkg-b/package.json");
//   const changesetConfigPath = path.join(cwd, ".changeset");

//   expect(git.add).toHaveBeenCalledWith(pkgAConfigPath, cwd);
//   expect(git.add).toHaveBeenCalledWith(pkgBConfigPath, cwd);
//   expect(git.add).toHaveBeenCalledWith(changesetConfigPath, cwd);
// });
// it("should git add the expected files (with changelog)", async () => {
//   let changelogPath = path.resolve(__dirname, "../../changelogs");
//   await writeChangesets([simpleChangeset2], cwd);
//   await versionCommand(cwd, {
//     ...modifiedDefaultConfig,
//     changelog: [changelogPath, null],
//     commit: true
//   });
//   const pkgAChangelogPath = path.join(cwd, "packages/pkg-a/CHANGELOG.md");
//   const pkgBChangelogPath = path.join(cwd, "packages/pkg-b/CHANGELOG.md");
//   expect(git.add).toHaveBeenCalledWith(pkgAChangelogPath, cwd);
//   expect(git.add).toHaveBeenCalledWith(pkgBChangelogPath, cwd);
// });
