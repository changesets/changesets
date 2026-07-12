import fs from "node:fs/promises";
import * as path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
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

vi.mock("@clack/prompts", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    log: mockedLogger,
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

function stubIsTTY(value: boolean) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process.stdin,
    "isTTY",
  );
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    ...originalDescriptor,
    value,
  });
  return {
    [Symbol.dispose]() {
      if (originalDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", originalDescriptor);
      } else {
        Reflect.deleteProperty(process.stdin, "isTTY");
      }
    },
  };
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

    vi.mocked(git.tagExists).mockResolvedValue(false);
    vi.mocked(git.remoteTagExists).mockResolvedValue(false);

    await publishCommand({ cwd });

    expect(git.tagExists).not.toHaveBeenCalled();
    expect(git.remoteTagExists).not.toHaveBeenCalled();
    expect(git.tag).not.toHaveBeenCalled();
  });

  it("publishes without otp in non-tty mode", async () => {
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

    using _ = stubIsTTY(false);
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

    expect(mockedExec).toHaveBeenCalledWith(
      "npm",
      expect.not.arrayContaining(["--otp"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          cwd: path.join(cwd, "packages", "pkg-a"),
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
          }),
        }),
      }),
    );
  });

  it("reads initial otp from env and strips it from forwarded env", async () => {
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

    vi.stubEnv("NPM_CONFIG_OTP", "123456");
    using _ = stubIsTTY(false);
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

    expect(mockedExec).toHaveBeenCalledWith(
      "npm",
      expect.arrayContaining(["publish", "--otp", "123456"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
          }),
        }),
      }),
    );
  });

  it("reads initial otp from PNPM_CONFIG_OTP for pnpm", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    vi.stubEnv("PNPM_CONFIG_OTP", "654321");
    using _ = stubIsTTY(false);
    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("11.0.0");
      }
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

    expect(mockedExec).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["publish", "--otp", "654321"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          env: expect.objectContaining({
            PNPM_CONFIG_OTP: undefined,
          }),
        }),
      }),
    );
  });

  it("uses yarn npm publish from the package directory for yarn berry", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        packageManager: "yarn@4.10.0",
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(false);
    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("4.10.0");
      }
      if (args[0] === "npm" && args[1] === "info") {
        return execResult("");
      }
      if (args[0] === "npm" && args[1] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(mockedExec).toHaveBeenCalledWith(
      "yarn",
      expect.arrayContaining(["npm", "publish", "--json"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          cwd: path.join(cwd, "packages", "pkg-a"),
        }),
      }),
    );
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
        .map((call) => call[2]?.nodeOptions?.cwd),
    ).toEqual([
      path.join(cwd, "packages", "pkg-b"),
      path.join(cwd, "packages", "pkg-a"),
    ]);
    expect(vi.mocked(git.tag).mock.calls.map((call) => call[0])).toEqual([
      "pkg-b@1.0.0",
      "pkg-a@1.0.0",
    ]);
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

  it("uses bare npm info object output to skip an already-published package", async () => {
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

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "info")
        .map((call) => call[1]),
    ).toEqual([["info", "pkg-a", "--json"]]);
    expect(git.tag).not.toHaveBeenCalled();
  });

  it("uses exact npm info object output after an empty bare npm info result", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-beta.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info" && args[1] === "pkg-a") {
        return execResult("");
      }
      if (args[0] === "info" && args[1] === "pkg-a@1.0.0-beta.0") {
        return execResult(
          JSON.stringify({
            version: "1.0.0-beta.0",
            versions: ["1.0.0-beta.0"],
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "info")
        .map((call) => call[1]),
    ).toEqual([
      ["info", "pkg-a", "--json"],
      ["info", "pkg-a@1.0.0-beta.0", "--json"],
    ]);
    expect(git.tag).not.toHaveBeenCalled();
  });

  it("unwraps single-item npm info array output", async () => {
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
      if (args[0] === "info") {
        return execResult(
          JSON.stringify([
            {
              version: "1.0.0",
              versions: ["1.0.0"],
            },
          ]),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(git.tag).not.toHaveBeenCalled();
  });

  it("does not treat failed npm info with empty stdout as unpublished", async () => {
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
      if (args[0] === "info") {
        return execResult(
          "",
          1,
          JSON.stringify({
            error: {
              code: "ENEEDAUTH",
              summary: "This command requires you to be logged in.",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "info")
        .map((call) => call[1]),
    ).toEqual([["info", "pkg-a", "--json"]]);
    expect(
      mockedExec.mock.calls.filter((call) => call[1]?.[0] === "publish"),
    ).toHaveLength(0);
  });

  it("treats pnpm info ERR_PNPM_FETCH_404 errors as unpublished", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult(
          JSON.stringify({
            error: {
              code: "ERR_PNPM_FETCH_404",
              message: "GET https://registry.npmjs.org/pkg-a: Not Found - 404",
            },
          }),
          1,
        );
      }
      if (args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls.filter((call) => call[1]?.[0] === "publish"),
    ).toHaveLength(1);
  });

  it("treats pnpm info ERR_PNPM_PACKAGE_NOT_FOUND errors as unpublished", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info") {
        return execResult(
          JSON.stringify({
            error: {
              code: "ERR_PNPM_PACKAGE_NOT_FOUND",
              message: "No matching version found for pkg-a@1.0.0",
            },
          }),
          1,
        );
      }
      if (args[0] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls.filter((call) => call[1]?.[0] === "publish"),
    ).toHaveLength(1);
  });

  it("retries exact pnpm info after bare package ERR_PNPM_PACKAGE_NOT_FOUND", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-beta.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args[0] === "info" && args[1] === "pkg-a") {
        return execResult(
          JSON.stringify({
            error: {
              code: "ERR_PNPM_PACKAGE_NOT_FOUND",
              message: "No matching version found for pkg-a@latest",
            },
          }),
          1,
        );
      }
      if (args[0] === "info" && args[1] === "pkg-a@1.0.0-beta.0") {
        return execResult(
          JSON.stringify({
            version: "1.0.0-beta.0",
            versions: ["1.0.0-beta.0"],
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "info")
        .map((call) => call[1]),
    ).toEqual([
      ["info", "pkg-a", "--json"],
      ["info", "pkg-a@1.0.0-beta.0", "--json"],
    ]);
    expect(git.tag).not.toHaveBeenCalled();
    expect(
      mockedExec.mock.calls.filter((call) => call[1]?.[0] === "publish"),
    ).toHaveLength(0);
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

  it("treats Yarn Berry info 404 reporter errors as unpublished", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        packageManager: "yarn@4.10.0",
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(false);
    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("4.10.0");
      }
      if (args[0] === "npm" && args[1] === "info") {
        return execResult(
          `${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "Package not found",
          })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "  Response Code: 404 (Not Found)",
          })}\n`,
          1,
        );
      }
      if (args[0] === "npm" && args[1] === "publish") {
        return execResult("");
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls.filter(
        (call) => call[1]?.[0] === "npm" && call[1]?.[1] === "publish",
      ),
    ).toHaveLength(1);
  });

  it("does not treat Yarn Berry non-404 info reporter errors as unpublished", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        packageManager: "yarn@4.10.0",
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(false);
    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("4.10.0");
      }
      if (args[0] === "npm" && args[1] === "info") {
        return execResult(
          `${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "You may not perform that action with these credentials.",
          })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "  Response Code: 403 (Forbidden)",
          })}\n`,
          1,
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(
      mockedExec.mock.calls.filter(
        (call) => call[1]?.[0] === "npm" && call[1]?.[1] === "publish",
      ),
    ).toHaveLength(0);
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("You may not perform that action"),
    );
  });

  it("does not log a success message for a failed publish", async () => {
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

    const successMessages = mockedLogger.success.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      successMessages.some((message) =>
        message.includes("Published pkg-a@1.0.0!"),
      ),
    ).toBe(false);
  });

  it("logs pnpm error messages from the message field", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("11.0.0");
      }
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult(
          "",
          1,
          JSON.stringify({
            error: {
              code: "E404",
              message: "404 Not Found - PUT https://registry.npmjs.org/pkg-a",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(mockedLogger.error).toHaveBeenCalled();
    const errorMessages = mockedLogger.error.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      errorMessages.some(
        (message) =>
          message.includes("An error occurred while publishing pkg-a: E404") &&
          message.includes(
            "404 Not Found - PUT https://registry.npmjs.org/pkg-a",
          ),
      ),
    ).toBe(true);
    expect(errorMessages.some((message) => message.includes("undefined"))).toBe(
      false,
    );
  });

  it("logs pnpm 10 error summaries from the summary field", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("10.0.0");
      }
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult(
          "",
          1,
          JSON.stringify({
            error: {
              code: "E404",
              summary: "404 Not Found - PUT https://registry.npmjs.org/pkg-a",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(mockedLogger.error).toHaveBeenCalled();
    const errorMessages = mockedLogger.error.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      errorMessages.some(
        (message) =>
          message.includes("An error occurred while publishing pkg-a: E404") &&
          message.includes(
            "404 Not Found - PUT https://registry.npmjs.org/pkg-a",
          ),
      ),
    ).toBe(true);
    expect(errorMessages.some((message) => message.includes("undefined"))).toBe(
      false,
    );
  });

  it("skips npm already-published JSON errors without a code", async () => {
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
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult(
          "",
          1,
          JSON.stringify({
            error: {
              summary:
                "You cannot publish over the previously published versions: 1.0.0.",
              detail: "",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(git.tag).not.toHaveBeenCalled();
    const successMessages = mockedLogger.success.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      successMessages.some((message) =>
        message.includes("Published pkg-a@1.0.0!"),
      ),
    ).toBe(false);
  });

  it("retries interactively when npm puts the OTP hint in the detail field", async () => {
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

    using _ = stubIsTTY(true);
    let publishAttempts = 0;
    mockedExec.mockImplementation(((cmd: string, args?: readonly string[]) => {
      const safeArgs = args ?? [];
      let result: ReturnType<typeof execResult>;
      if (safeArgs[0] === "info") {
        result = execResult("");
      } else if (safeArgs[0] === "publish") {
        publishAttempts++;
        result =
          publishAttempts === 1
            ? execResult(
                "",
                1,
                JSON.stringify({
                  error: {
                    code: "E401",
                    summary:
                      "This operation requires a one-time password from your authenticator.",
                    detail:
                      "You can provide a one-time password by passing --otp=<code> to the command you ran.",
                  },
                }),
              )
            : execResult("");
      } else {
        throw new Error(`Unexpected exec args: ${safeArgs.join(" ")}`);
      }
      return Object.assign(Promise.resolve(result), {
        exitCode: result.exitCode,
        command: cmd,
      });
    }) as any);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "publish")
        .map((call) => call[1]),
    ).toEqual([
      expect.arrayContaining(["publish", "--json"]),
      expect.not.arrayContaining(["--json"]),
    ]);
    expect(git.tag).toHaveBeenCalledWith("pkg-a@1.0.0", cwd);
  });

  it("retries interactively when pnpm reports a non-interactive OTP error", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(true);
    let publishAttempts = 0;
    mockedExec.mockImplementation(((cmd: string, args?: readonly string[]) => {
      const safeArgs = args ?? [];
      let result: ReturnType<typeof execResult>;
      if (safeArgs.length === 1 && safeArgs[0] === "--version") {
        result = execResult("11.0.0");
      } else if (safeArgs[0] === "info") {
        result = execResult("");
      } else if (safeArgs[0] === "publish") {
        publishAttempts++;
        result =
          publishAttempts === 1
            ? execResult(
                "",
                1,
                JSON.stringify({
                  error: {
                    code: "ERR_PNPM_OTP_NON_INTERACTIVE",
                    message:
                      "The registry requires additional authentication, but pnpm is not running in an interactive terminal",
                  },
                }),
              )
            : execResult("");
      } else {
        throw new Error(`Unexpected exec args: ${safeArgs.join(" ")}`);
      }
      return Object.assign(Promise.resolve(result), {
        exitCode: result.exitCode,
        command: cmd,
      });
    }) as any);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "publish")
        .map((call) => call[1]),
    ).toEqual([
      expect.arrayContaining(["publish", "--json"]),
      expect.not.arrayContaining(["--json"]),
    ]);
    expect(git.tag).toHaveBeenCalledWith("pkg-a@1.0.0", cwd);
  });

  it("retries interactively when Yarn Berry reports an auth reporter error", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        packageManager: "yarn@4.10.0",
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(true);
    let publishAttempts = 0;
    mockedExec.mockImplementation(((cmd: string, args?: readonly string[]) => {
      const safeArgs = args ?? [];
      let result: ReturnType<typeof execResult>;
      if (safeArgs.length === 1 && safeArgs[0] === "--version") {
        result = execResult("4.10.0");
      } else if (safeArgs[0] === "npm" && safeArgs[1] === "info") {
        result = execResult("");
      } else if (safeArgs[0] === "npm" && safeArgs[1] === "publish") {
        publishAttempts++;
        result =
          publishAttempts === 1
            ? execResult(
                `${JSON.stringify({ file: "package.json" })}\n${JSON.stringify({
                  type: "error",
                  name: 33,
                  displayName: "YN0033",
                  indent: "",
                  data: "No authentication configured for request",
                })}\n${JSON.stringify({
                  type: "error",
                  name: 0,
                  displayName: "YN0000",
                  indent: "",
                  data: "Failed with errors in 0s 77ms",
                })}\n`,
                1,
              )
            : execResult("");
      } else {
        throw new Error(`Unexpected exec args: ${safeArgs.join(" ")}`);
      }
      return Object.assign(Promise.resolve(result), {
        exitCode: result.exitCode,
        command: cmd,
      });
    }) as any);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      mockedExec.mock.calls
        .filter((call) => call[1]?.[0] === "npm" && call[1]?.[1] === "publish")
        .map((call) => call[1]),
    ).toEqual([
      expect.arrayContaining(["npm", "publish", "--json"]),
      expect.not.arrayContaining(["--json"]),
    ]);
    expect(git.tag).toHaveBeenCalledWith("pkg-a@1.0.0", cwd);
  });

  it("skips already-published pnpm JSON errors from the message field", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("11.0.0");
      }
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
              message:
                "You cannot publish over the previously published version 1.0.0.",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(git.tag).not.toHaveBeenCalled();
    const successMessages = mockedLogger.success.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      successMessages.some((message) =>
        message.includes("Published pkg-a@1.0.0!"),
      ),
    ).toBe(false);
  });

  it("skips already-published Yarn Berry network reporter errors", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        packageManager: "yarn@4.10.0",
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("4.10.0");
      }
      if (args[0] === "npm" && args[1] === "info") {
        return execResult("");
      }
      if (args[0] === "npm" && args[1] === "publish") {
        return execResult(
          `${JSON.stringify({ file: "package.json" })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "You cannot publish over the previously published versions: 1.0.0.",
          })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "  Response Code: 403 (Forbidden)",
          })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "  Request Method: PUT",
          })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "  Request URL: https://registry.npmjs.org/pkg-a",
          })}\n${JSON.stringify({
            type: "error",
            name: 0,
            displayName: "YN0000",
            indent: "",
            data: "Failed with errors in 0s 706ms",
          })}\n`,
          1,
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(git.tag).not.toHaveBeenCalled();
    const successMessages = mockedLogger.success.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      successMessages.some((message) =>
        message.includes("Published pkg-a@1.0.0!"),
      ),
    ).toBe(false);
  });

  it("logs Yarn Berry reporter error data", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        packageManager: "yarn@4.10.0",
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(false);
    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("4.10.0");
      }
      if (args[0] === "npm" && args[1] === "info") {
        return execResult("");
      }
      if (args[0] === "npm" && args[1] === "publish") {
        return execResult(
          `${JSON.stringify({ file: "package.json" })}\n${JSON.stringify({
            type: "error",
            name: 33,
            displayName: "YN0033",
            indent: "",
            data: "No authentication configured for request",
          })}\n${JSON.stringify({
            type: "error",
            name: 35,
            displayName: "YN0035",
            indent: "",
            data: "This belongs to a different error group",
          })}\n${JSON.stringify({
            type: "error",
            name: 0,
            displayName: "YN0000",
            indent: "",
            data: "Failed with errors in 0s 77ms",
          })}\n`,
          1,
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await expect(publishCommand({ cwd })).rejects.toThrow();

    expect(mockedLogger.error).toHaveBeenCalled();
    const errorMessages = mockedLogger.error.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      errorMessages.some(
        (message) =>
          message.includes(
            "An error occurred while publishing pkg-a: YN0033",
          ) && message.includes("No authentication configured for request"),
      ),
    ).toBe(true);
    const formattedError = errorMessages.find((message) =>
      message.includes("An error occurred while publishing pkg-a: YN0033"),
    );
    expect(formattedError).not.toContain(
      "This belongs to a different error group",
    );
  });

  it("skips already-published pnpm publish failures wrapped in ERR_PNPM_FAILED_TO_PUBLISH", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockExecImplementation(async (_command, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return execResult("11.0.0");
      }
      if (args[0] === "info") {
        return execResult("");
      }
      if (args[0] === "publish") {
        return execResult(
          "",
          1,
          JSON.stringify({
            error: {
              code: "ERR_PNPM_FAILED_TO_PUBLISH",
              message:
                "Failed to publish pkg-a@1.0.0: You cannot publish over the previously published version 1.0.0.",
            },
          }),
        );
      }
      throw new Error(`Unexpected exec args: ${args.join(" ")}`);
    });

    await publishCommand({ cwd });

    expect(git.tag).not.toHaveBeenCalled();
    const successMessages = mockedLogger.success.mock.calls.map((call) =>
      stripVTControlCharacters(String(call[0])),
    );
    expect(
      successMessages.some((message) =>
        message.includes("Published pkg-a@1.0.0!"),
      ),
    ).toBe(false);
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
          path.join("..", "..", ".packed", "packages", "pkg-a-1.0.0.tgz"),
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
