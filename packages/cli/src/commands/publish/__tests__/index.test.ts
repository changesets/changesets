import * as path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import type { Config } from "@changesets/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";
import * as publishPackagesModule from "../publishPackages.ts";

vi.mock("@changesets/git");
vi.mock("../publishPackages.ts");

const changelogPath = path.resolve(import.meta.dirname, "../../changelog");
const modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};

describe("Publish command", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not tag ignored private packages", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        private: true,
      }),
      ".changeset/config.json": JSON.stringify({
        ...defaultConfig,
        privatePackages: {
          version: true,
          tag: true,
        },
        ignore: ["pkg-a"],
      }),
    });

    vi.mocked(publishPackagesModule.publishPackages).mockResolvedValue([]);
    vi.mocked(git.tagExists).mockResolvedValue(false);
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);

    await publishCommand({ cwd });

    expect(git.tagExists).not.toHaveBeenCalled();
    expect(git.remoteTagExists).not.toHaveBeenCalled();
    expect(git.tag).not.toHaveBeenCalled();
  });

  describe("in pre state", () => {
    it("should report error if the tag option is used in pre release", async () => {
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
        ".changeset/pre.json": JSON.stringify({
          ...modifiedDefaultConfig,
          mode: "pre",
        }),
      });
      await expect(
        publishCommand({ cwd, tag: "experimental" }),
      ).rejects.toThrow();
    });
  });
});
