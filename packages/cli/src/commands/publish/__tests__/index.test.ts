import * as path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import type { Config } from "@changesets/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";
import * as npmUtils from "../npm-utils.ts";

vi.mock("@changesets/git");
vi.mock("../npm-utils.ts");

const changelogPath = path.resolve(import.meta.dirname, "../../changelog");
const modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};
const mockedNpmUtils = vi.mocked(npmUtils);

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

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    });
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

  it("publishes release chunks sequentially", async () => {
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
          "pkg-b": "workspace:*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    });
    mockedNpmUtils.publish
      .mockResolvedValueOnce({ result: "published" })
      .mockResolvedValueOnce({ result: "published" });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(mockedNpmUtils.publish.mock.calls.map((call) => call[0].name)).toEqual(
      ["pkg-b", "pkg-a"],
    );
    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-b@1.0.0",
      "pkg-a@1.0.0",
    ]);
  });

  it("stops publishing after a failed chunk", async () => {
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
          "pkg-b": "workspace:*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    });
    mockedNpmUtils.publish.mockResolvedValueOnce({ result: "failed" });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(mockedNpmUtils.publish).toHaveBeenCalledTimes(1);
    expect(git.tag).not.toHaveBeenCalled();
  });

  it("tags tag-only releases within their chunk", async () => {
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
        private: true,
        peerDependencies: {
          "pkg-a": "workspace:*",
        },
      }),
      ".changeset/config.json": JSON.stringify({
        ...defaultConfig,
        privatePackages: {
          version: true,
          tag: true,
        },
      }),
    });

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    });
    mockedNpmUtils.publish.mockResolvedValueOnce({ result: "published" });
    vi.mocked(git.tagExists).mockResolvedValue(false);
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-a@1.0.0",
      "pkg-b@1.0.0",
    ]);
  });
});
