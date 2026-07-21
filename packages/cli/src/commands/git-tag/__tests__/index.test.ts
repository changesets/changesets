import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { describe, expect, it, vi } from "vitest";
import { gitTag } from "../index.ts";

vi.mock("@changesets/git");
const mockedGit = vi.mocked(git);

describe("git-tag command", () => {
  silenceLogsInBlock();

  describe("workspace project", () => {
    it("tags all packages", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          dependencies: {
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      mockedGit.getAllTags.mockResolvedValueOnce(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await gitTag({ cwd });
      expect(git.tag).toHaveBeenCalledTimes(2);
      expect(mockedGit.tag.mock.calls[0][0]).toEqual("pkg-a@1.0.0");
      expect(mockedGit.tag.mock.calls[1][0]).toEqual("pkg-b@1.0.0");
    });

    it("does not tag ignored packages", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          ignore: ["pkg-a"],
        }),
      });

      mockedGit.getAllTags.mockResolvedValueOnce(new Set());

      await gitTag({ cwd });

      expect(mockedGit.tag).toHaveBeenCalledExactlyOnceWith("pkg-b@1.0.0", cwd);
    });

    it("writes tag events when output path is provided", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });
      const outputFile = path.join(cwd, "output.ndjson");

      mockedGit.getAllTags.mockResolvedValueOnce(new Set());

      await gitTag({ cwd, output: outputFile });

      await expect(fs.readFile(outputFile, "utf8")).resolves.toBe(
        [
          JSON.stringify({
            type: "git-tag",
            tag: "pkg-a@1.0.0",
            packageName: "pkg-a",
          }),
          JSON.stringify({
            type: "git-tag",
            tag: "pkg-b@1.0.0",
            packageName: "pkg-b",
          }),
          "",
        ].join("\n"),
      );
    });

    it("creates an empty output file when there is nothing to tag", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });
      const outputFile = path.join(cwd, "output.ndjson");

      mockedGit.getAllTags.mockResolvedValueOnce(new Set(["pkg-a@1.0.0"]));

      await gitTag({ cwd, output: outputFile });

      await expect(fs.readFile(outputFile, "utf8")).resolves.toBe("");
    });

    it("skips tags that already exist", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          dependencies: {
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      mockedGit.getAllTags.mockResolvedValueOnce(
        new Set([
          // pkg-a should not be re-tagged
          "pkg-a@1.0.0",
        ]),
      );

      expect(git.tag).not.toHaveBeenCalled();
      await gitTag({ cwd });
      expect(git.tag).toHaveBeenCalledOnce();
      expect(mockedGit.tag.mock.calls[0][0]).toEqual("pkg-b@1.0.0");
    });
  });

  describe("single package repo", () => {
    it("uses a simplified version-only tag", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          name: "root-only",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          privatePackages: {
            version: true,
            tag: true,
          },
        }),
      });
      mockedGit.getAllTags.mockResolvedValueOnce(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await gitTag({ cwd });
      expect(git.tag).toHaveBeenCalledOnce();
      expect(mockedGit.tag.mock.calls[0][0]).toEqual("v1.0.0");
    });

    it("does not tag on private", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          name: "root-only",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });
      mockedGit.getAllTags.mockResolvedValueOnce(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await gitTag({ cwd });
      expect(git.tag).toHaveBeenCalledTimes(0);
    });
  });
});
