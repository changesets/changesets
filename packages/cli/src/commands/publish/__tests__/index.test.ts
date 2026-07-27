import fs from "node:fs/promises";
import * as path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, stubIsTTY, testdir } from "@changesets/test-utils";
import type { Config } from "@changesets/types";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";

const mockedLogger = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));
const mockedSpinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@clack/prompts", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    log: mockedLogger,
    spinner: () => mockedSpinner,
  };
});

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
    vi.unstubAllEnvs();
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

    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);

    await publishCommand({ cwd });

    expect(git.getAllTags).not.toHaveBeenCalled();
    expect(git.remoteTagExists).not.toHaveBeenCalled();
    expect(git.tag).not.toHaveBeenCalled();
  });

  it("does not tag tag-only releases when git tagging is disabled", async () => {
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
      }),
    });

    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);

    await publishCommand({ cwd, gitTag: false });

    expect(git.tag).not.toHaveBeenCalled();
  });

  it("in pre state should report error if the tag option is used in pre release", async () => {
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
    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "publish")
        .map((call) => call[2]?.nodeOptions?.cwd),
    ).toEqual([
      path.join(cwd, "packages", "pkg-b"),
      path.join(cwd, "packages", "pkg-a"),
    ]);
    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-b@1.0.0",
      "pkg-a@1.0.0",
    ]);
    expect(mockedSpinner.stop).toHaveBeenCalledExactlyOnceWith(
      "Created git tags.",
    );
  });

  it("renders existing tags for successful publishes", async () => {
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
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info" || args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.getAllTags).mockResolvedValue(new Set(["pkg-a@1.0.0"]));

    await publishCommand({ cwd });

    expect(git.tag).not.toHaveBeenCalled();
    expect(mockedSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining("Skipped tags (already exist):"),
    );
    expect(mockedSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining("pkg-a@1.0.0"),
    );
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
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });
    const outputFile = path.join(cwd, "output.ndjson");

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd, output: outputFile });

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

  it("creates an empty output file when there is nothing to publish or tag", async () => {
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
    });
    const outputFile = path.join(cwd, "output.ndjson");

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult(
          JSON.stringify({
            version: "1.0.0",
            versions: ["1.0.0"],
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd, output: outputFile });

    await expect(fs.readFile(outputFile, "utf8")).resolves.toBe("");
    expect(git.tag).not.toHaveBeenCalled();
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

  it("attempts every package in a failing non-TTY chunk", async () => {
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
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult(
          JSON.stringify({
            error: {
              code: "E403",
              summary: "failed",
            },
          }),
          1,
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    const publishedPackages = mockedExec.mock.calls
      .filter((call) => call[1]?.[0] === "publish")
      .map((call) => path.basename(String(call[2]!.nodeOptions!.cwd)));
    expect(publishedPackages).toHaveLength(2);
    expect(publishedPackages).toEqual(
      expect.arrayContaining(["pkg-a", "pkg-b"]),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Some packages failed to publish:"),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("E403: failed"),
    );
    expect(git.tag).not.toHaveBeenCalled();
  });

  it("does not recover 2FA failures when the same bulk publish has a hard failure", async () => {
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
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    let publishCount = 0;
    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        publishCount++;
        if (publishCount === 1) {
          return execResult("");
        }
        if (publishCount === 2) {
          return execResult(
            JSON.stringify({
              error: {
                code: "EOTP",
                summary: "The provided OTP is invalid.",
                detail: "",
              },
            }),
            1,
          );
        }
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
    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.tag).mockResolvedValue(true);

    using _isTTY = stubIsTTY(true);
    await expect(publishCommand({ cwd })).rejects.toThrow();

    const publishCalls = mockedExec.mock.calls.filter(
      (call) => call[1]?.[0] === "publish",
    );
    expect(publishCalls).toHaveLength(3);
    expect(
      publishCalls.some((call) => call[2]?.nodeOptions?.stdio === "inherit"),
    ).toBe(false);
  });

  it("returns to sequential publishing when an OTP becomes invalid during bulk publishing, then resumes bulk publishing", async () => {
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
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "1.0.0",
      }),
      "packages/pkg-d/package.json": JSON.stringify({
        name: "pkg-d",
        version: "1.0.0",
      }),
      "packages/pkg-e/package.json": JSON.stringify({
        name: "pkg-e",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    const successfulPublish = execResult("");
    const invalidOtp = execResult(
      JSON.stringify({
        error: {
          code: "EOTP",
          summary: "The provided OTP is invalid.",
          detail: "",
        },
      }),
      1,
    );
    const otpResults = [
      successfulPublish,
      invalidOtp,
      invalidOtp,
      invalidOtp,
      invalidOtp,
    ];
    const resumedBulk = Promise.withResolvers<ReturnType<typeof execResult>>();
    const nonOtpResults = [
      Promise.resolve(successfulPublish),
      resumedBulk.promise,
      resumedBulk.promise,
    ];

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return successfulPublish;
      }
      if (args[0] === "publish") {
        if (args.includes("--otp")) {
          return otpResults.shift()!;
        }
        if (args.includes("--json")) {
          return nonOtpResults.shift()!;
        }
        return successfulPublish;
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.tag).mockResolvedValue(true);

    using _isTTY = stubIsTTY(true);
    const publishing = publishCommand({ cwd, otp: "expired" });

    await vi.waitFor(() => {
      expect(
        mockedExec.mock.calls.filter(
          (call) =>
            call[1]?.[0] === "publish" &&
            call[1].includes("--json") &&
            !call[1].includes("--otp"),
        ),
      ).toHaveLength(3);
    });

    resumedBulk.resolve(successfulPublish);
    await publishing;

    const publishCalls = mockedExec.mock.calls.filter(
      (call) => call[1]?.[0] === "publish",
    );
    expect(publishCalls).toHaveLength(9);
    for (const call of publishCalls.slice(0, 5)) {
      expect(call[1]).toEqual(
        expect.arrayContaining(["--json", "--otp", "expired"]),
      );
    }
    expect(publishCalls[5]?.[1]).not.toContain("--otp");
    expect(publishCalls[5]?.[2]?.nodeOptions?.stdio).toBe("inherit");
    for (const call of publishCalls.slice(6)) {
      expect(call[1]).toContain("--json");
      expect(call[1]).not.toContain("--otp");
    }
  });

  it("tags tag-only releases from a failing chunk", async () => {
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
    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);
    vi.mocked(git.tag).mockResolvedValue(true);

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "publish")
        .map((call) => call[2]?.nodeOptions?.cwd),
    ).toEqual([path.join(cwd, "packages", "pkg-a")]);
    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-b@1.0.0",
    ]);
    expect(mockedSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining("pkg-b@1.0.0"),
    );
    expect(mockedSpinner.stop).not.toHaveBeenCalledWith(
      expect.stringContaining("pkg-a@1.0.0"),
    );
  });

  it("does not tag tag-only releases after a failing chunk", async () => {
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
    vi.mocked(git.getAllTags).mockResolvedValue(new Set());
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);
    vi.mocked(git.tag).mockResolvedValue(true);

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "publish")
        .map((call) => call[2]?.nodeOptions?.cwd),
    ).toEqual([path.join(cwd, "packages", "pkg-a")]);
    expect(git.tag).not.toHaveBeenCalled();
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
