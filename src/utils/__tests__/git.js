import { copyFixtureIntoTempDir } from "jest-fixtures";
import spawn from "projector-spawn";
import path from "path";

import {
  getCommitThatAddsFile,
  getChangedFilesSince,
  add,
  commit,
  tag,
  getChangedPackagesSinceMaster,
  getChangedChangesetFilesSinceMaster
} from '../git';

describe("git", () => {
  let cwd;
  beforeEach(async () => {
    cwd = await copyFixtureIntoTempDir(__dirname, "with-git");
    await spawn("git", ["init"], { cwd: cwd });
  });

  describe("add", () => {
    it("should add a file to the staging area", async () => {
      await add("packages/pkg-a/package.json", cwd);

      const gitCmd = await spawn("git", ["diff", "--name-only", "--cached"], { cwd: cwd });
      const stagedFiles = gitCmd.stdout.split('\n').filter(a => a);

      expect(stagedFiles).toHaveLength(1);
      expect(stagedFiles[0]).toEqual("packages/pkg-a/package.json");
    });

    it("should add multiple files to the staging area", async () => {
      await add("package.json", cwd);
      await add("packages/pkg-a/package.json", cwd);
      await add("packages/pkg-b/package.json", cwd);

      const gitCmd = await spawn("git", ["diff", "--name-only", "--cached"], { cwd: cwd });
      const stagedFiles = gitCmd.stdout.split('\n').filter(a => a);

      expect(stagedFiles).toHaveLength(3);
      expect(stagedFiles[0]).toEqual("package.json");
      expect(stagedFiles[1]).toEqual("packages/pkg-a/package.json");
      expect(stagedFiles[2]).toEqual("packages/pkg-b/package.json");
    });

    it("should add a directory", async () => {
      await add("packages", cwd);

      const gitCmd = await spawn("git", ["diff", "--name-only", "--cached"], { cwd: cwd });
      const stagedFiles = gitCmd.stdout.split('\n').filter(a => a);

      expect(stagedFiles).toHaveLength(4);
      expect(stagedFiles[0]).toEqual("packages/pkg-a/index.js");
      expect(stagedFiles[1]).toEqual("packages/pkg-a/package.json");
      expect(stagedFiles[2]).toEqual("packages/pkg-b/index.js");
      expect(stagedFiles[3]).toEqual("packages/pkg-b/package.json");
    });
  });

  describe("commit", () => {
    it("should commit a file", async () => {
      await add("packages/pkg-a/package.json", cwd);
      await commit("added packageA package.json", cwd);

      const gitCmd = await spawn("git", ["log", "-1", "--pretty=%B"], { cwd: cwd });
      const commitMessage = gitCmd.stdout.trim();

      expect(commitMessage).toEqual("added packageA package.json");
    });
  });

  describe("tag", () => {
    beforeEach(async () => {
      await add("packages/pkg-a/package.json", cwd);
      await commit("added packageA package.json", cwd);
    });

    it("should create a tag for the current head", async () => {
      const head = await spawn("git", ["rev-parse", "HEAD"], { cwd: cwd });
      await tag("tag_message", cwd);

      // Gets the hash of the commit the tag is referring to, not the hash of the tag itself
      const tagRef = await spawn("git", ["rev-list", "-n", "1", "tag_message"], { cwd: cwd });
      expect(tagRef).toEqual(head);
    });

    it('should create a tag, make a new commit, then create a second tag', async () => {
      const initialHead = await spawn("git", ["rev-parse", "HEAD"], { cwd: cwd });
      await tag("tag_message", cwd);
      await add("packages/pkg-b/package.json", cwd);
      await commit("added packageB package.json", cwd);
      const newHead = await spawn("git", ["rev-parse", "HEAD"], { cwd: cwd });
      await tag("new_tag", cwd);

      // Gets the hash of the commit the tag is referring to, not the hash of the tag itself
      const firstTagRef = await spawn("git", ["rev-list", "-n", "1", "tag_message"], { cwd: cwd });
      const secondTagRef = await spawn("git", ["rev-list", "-n", "1", "new_tag"], { cwd: cwd });

      expect(firstTagRef).toEqual(initialHead);
      expect(secondTagRef).toEqual(newHead);
    })
  });

  describe("getCommitThatAddsFile", () => {
    it("should commit a file and get the hash of that commit", async () => {
      await add("packages/pkg-b/package.json", cwd);
      await commit("added packageB package.json", cwd);
      const head = await spawn("git", ["rev-parse", "--short", "HEAD"], { cwd: cwd });

      const commitHash = await getCommitThatAddsFile("packages/pkg-b/package.json", cwd);

      expect(commitHash).toEqual(head.stdout.trim());
    });
  });

  describe("getChangedFilesSince", () => {
    beforeEach(async () => {
      await add("packages/pkg-a/package.json", cwd);
      await commit("added packageA package.json", cwd);
    });

    it("should be empty if no changes", async () => {
      const head = await spawn("git", ["rev-parse", "HEAD"], { cwd: cwd });
      const changedFiles = await getChangedFilesSince(head.stdout.trim(), cwd);
      expect(changedFiles.filter(a => a)).toHaveLength(0);
    });

    it("should get list of files that have been committed", async () => {
      const firstRef = await spawn("git", ["rev-parse", "HEAD"], { cwd: cwd });
      await add("packages/pkg-a/index.js", cwd);
      await commit("added packageA index", cwd);

      const secondRef = await spawn("git", ["rev-parse", "HEAD"], { cwd: cwd });
      await add("packages/pkg-b/index.js", cwd);
      await add("packages/pkg-b/package.json", cwd);
      await commit("added packageB files", cwd);

      const filesChangedSinceFirstRef = await getChangedFilesSince(firstRef.stdout.trim(), cwd);
      expect(filesChangedSinceFirstRef[0]).toEqual("packages/pkg-a/index.js");
      expect(filesChangedSinceFirstRef[1]).toEqual("packages/pkg-b/index.js");
      expect(filesChangedSinceFirstRef[2]).toEqual("packages/pkg-b/package.json");

      const filesChangedSinceSecondRef = await getChangedFilesSince(secondRef.stdout.trim(), cwd);
      expect(filesChangedSinceSecondRef[0]).toEqual("packages/pkg-b/index.js");
      expect(filesChangedSinceSecondRef[1]).toEqual("packages/pkg-b/package.json");
    });
  });

  describe("getChangedPackagesSinceMaster", () => {
    beforeEach(async () => {
      await add("packages/pkg-a/package.json", cwd);
      await commit("added packageA package.json", cwd);
    });

    it("should return an empty list if no packages have changed", async () => {
      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });
      const changedPackages = await getChangedPackagesSinceMaster(cwd);
      expect(changedPackages).toHaveLength(0);
    });

    it("should check changed packages on a branch against master", async () => {
      await spawn("git", ["checkout", "-b", "new-branch"], { cwd });
      await add("packages/pkg-a/index.js", cwd);
      await commit("added packageA index", cwd);

      await add("packages/pkg-b/index.js", cwd);
      await add("packages/pkg-b/package.json", cwd);
      await commit("added packageB files", cwd);

      const changedPackages = await getChangedPackagesSinceMaster(cwd);

      expect(changedPackages).toHaveLength(2);
      expect(changedPackages[0].name).toEqual("pkg-a");
      expect(changedPackages[1].name).toEqual("pkg-b");
    });
  });

  describe("getChangedChangesetFilesSinceMaster", () => {
    beforeEach(async () => {
      await add("packages/pkg-a/package.json", cwd);
      await commit("added packageA package.json", cwd);
    });

    it("should be empty if no changeset files have been added", async () => {
      const files = await getChangedChangesetFilesSinceMaster(cwd);
      expect(files).toHaveLength(0);
    });

    it("should get the relative path to the changeset file", async () => {
      await add(".changeset", cwd);

      const files = await getChangedChangesetFilesSinceMaster(cwd);
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual(".changeset/changes.json");
    });

    it("should get the absolute path to the changeset file", async () => {
      await add(".changeset", cwd);

      const files = await getChangedChangesetFilesSinceMaster(cwd, true);
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual(path.resolve(cwd, ".changeset/changes.json"));
    });
  });
});
