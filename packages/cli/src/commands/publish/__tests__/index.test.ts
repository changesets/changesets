import publishCommand from "../index";
import { defaultConfig } from "@changesets/config";
import * as path from "path";
import { Config } from "@changesets/types";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import * as git from "@changesets/git";
import publishPackages from "../publishPackages";

let changelogPath = path.resolve(__dirname, "../../changelog");
let modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};

jest.mock("@changesets/git");
// @ts-ignore
git.tag.mockImplementation(() => Promise.resolve(true));
// @ts-ignore
git.getAllTags.mockImplementation(() => Promise.resolve(new Set()));

jest.mock("../publishPackages");

describe("Publish command", () => {
  silenceLogsInBlock();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("in pre state", () => {
    it("should report error if the tag option is used in pre release", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/pre.json": JSON.stringify({
          mode: "pre",
        }),
      });
      await expect(
        publishCommand(cwd, { tag: "experimental" }, modifiedDefaultConfig)
      ).rejects.toThrowError();
    });
  });

  describe("workspace project", () => {
    it("uses root-tag-style format when all packages are fixed", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
      });

      // @ts-ignore
      publishPackages.mockImplementation(() =>
        Promise.resolve([
          { name: "pkg-a", newVersion: "1.1.0", published: true },
          { name: "pkg-b", newVersion: "1.1.0", published: true },
        ])
      );

      await publishCommand(
        cwd,
        {},
        {
          ...modifiedDefaultConfig,
          fixed: [["pkg-a", "pkg-b"]],
        }
      );

      expect(git.tag).toHaveBeenCalledTimes(1);
      expect(git.tag).toHaveBeenNthCalledWith(1, "v1.1.0", cwd);
    });

    it("uses package-tag-style format when not all packages are fixed", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        "packages/pkg-c/package.json": JSON.stringify({
          name: "pkg-c",
          version: "2.0.0",
        }),
      });

      // @ts-ignore
      publishPackages.mockImplementation(() =>
        Promise.resolve([
          { name: "pkg-a", newVersion: "1.1.0", published: true },
          { name: "pkg-b", newVersion: "1.1.0", published: true },
          { name: "pkg-c", newVersion: "2.0.1", published: true },
        ])
      );

      await publishCommand(
        cwd,
        {},
        {
          ...modifiedDefaultConfig,
          fixed: [["pkg-a", "pkg-b"]],
        }
      );

      expect(git.tag).toHaveBeenCalledTimes(3);
      expect(git.tag).toHaveBeenNthCalledWith(1, "pkg-a@1.1.0", cwd);
      expect(git.tag).toHaveBeenNthCalledWith(2, "pkg-b@1.1.0", cwd);
      expect(git.tag).toHaveBeenNthCalledWith(3, "pkg-c@2.0.1", cwd);
    });

    it("uses package-tag-style format when there are multiple fixed groups", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        "packages/pkg-c/package.json": JSON.stringify({
          name: "pkg-c",
          version: "2.0.0",
        }),
        "packages/pkg-d/package.json": JSON.stringify({
          name: "pkg-d",
          version: "2.0.0",
        }),
      });

      // @ts-ignore
      publishPackages.mockImplementation(() =>
        Promise.resolve([
          { name: "pkg-a", newVersion: "1.1.0", published: true },
          { name: "pkg-b", newVersion: "1.1.0", published: true },
          { name: "pkg-c", newVersion: "2.1.0", published: true },
          { name: "pkg-d", newVersion: "2.1.0", published: true },
        ])
      );

      await publishCommand(
        cwd,
        {},
        {
          ...modifiedDefaultConfig,
          fixed: [
            ["pkg-a", "pkg-b"],
            ["pkg-c", "pkg-d"],
          ],
        }
      );

      expect(git.tag).toHaveBeenCalledTimes(4);
      expect(git.tag).toHaveBeenNthCalledWith(1, "pkg-a@1.1.0", cwd);
      expect(git.tag).toHaveBeenNthCalledWith(2, "pkg-b@1.1.0", cwd);
      expect(git.tag).toHaveBeenNthCalledWith(3, "pkg-c@2.1.0", cwd);
      expect(git.tag).toHaveBeenNthCalledWith(4, "pkg-d@2.1.0", cwd);
    });
  });

  describe("single package project", () => {
    it("uses a simplified version-only tag", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          name: "single-package",
          version: "1.0.0",
        }),
      });

      // @ts-ignore
      publishPackages.mockImplementation(() =>
        Promise.resolve([
          { name: "single-package", newVersion: "1.1.0", published: true },
        ])
      );

      await publishCommand(cwd, {}, modifiedDefaultConfig);

      expect(git.tag).toHaveBeenCalledTimes(1);
      expect(git.tag).toHaveBeenNthCalledWith(1, "v1.1.0", cwd);
    });
  });
});
