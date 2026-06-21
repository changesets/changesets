import * as path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import type { Config } from "@changesets/types";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";

vi.mock("@changesets/git");
vi.mock("tinyexec");

const changelogPath = path.resolve(import.meta.dirname, "../../changelog");
const modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};
const mockedExec = vi.mocked(exec);

function execResult(stdout: string, exitCode = 0, stderr = "") {
  return {
    command: "",
    args: [],
    stdout,
    stderr,
    exitCode,
    failed: exitCode !== 0,
    signal: undefined,
    killed: false,
  };
}

function mockExecImplementation(
  fn: (
    cmd: string,
    args: readonly string[],
  ) => Promise<ReturnType<typeof execResult>>,
) {
  mockedExec.mockImplementation(((cmd: string, args?: readonly string[]) =>
    Promise.resolve(fn(cmd, args ?? []))) as any);
}

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

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "publish")
        .map((call) => call[1]?.[1]),
    ).toEqual([
      path.join(cwd, "packages/pkg-b"),
      path.join(cwd, "packages/pkg-a"),
    ]);
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

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult(
          "",
          1,
          JSON.stringify({
            error: {
              code: "E403",
              summary: "failed",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(
      mockedExec.mock.calls.filter((call) => call[1]?.[0] === "publish"),
    ).toHaveLength(1);
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

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tagExists).mockResolvedValue(false);
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-a@1.0.0",
      "pkg-b@1.0.0",
    ]);
  });

  it("publishes from a pack directory", async () => {
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
      ".changeset/config.json": JSON.stringify(defaultConfig),
      ".packed/publish-plan.json": JSON.stringify({
        version: 1,
        plan: [
          [
            {
              kind: "publish",
              name: "pkg-a",
              version: "1.0.0",
              access: "public",
              tag: "latest",
              tarball: {
                path: "packages/pkg-a-1.0.0.tgz",
                integrity: "sha256-abc",
              },
            },
          ],
        ],
      }),
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd, fromPackDir: ".packed" });

    expect(
      mockedExec.mock.calls.filter((call) => call[1]?.[0] === "publish"),
    ).toEqual([
      expect.arrayContaining([
        "npm",
        [
          "publish",
          path.join(cwd, ".packed/packages/pkg-a-1.0.0.tgz"),
          "--access",
          "public",
          "--tag",
          "latest",
          "--json",
        ],
        expect.anything(),
      ]),
    ]);
    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-a@1.0.0",
    ]);
  });

  it("rejects custom tags when publishing from a pack directory", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    await expect(
      publishCommand({ cwd, fromPackDir: ".packed", tag: "beta" }),
    ).rejects.toThrow();
  });
});
