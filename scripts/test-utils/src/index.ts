import type fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createFixture, type FileTree } from "fs-fixture";
import { exec } from "tinyexec";
import { afterEach, beforeEach, onTestFinished, vi } from "vitest";

vi.mock("@clack/prompts", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    note: vi.fn(),
    log: {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

const createLogSilencer = () => {
  const originalConsoleError = console.error;
  const originalConsoleInfo = console.info;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  return {
    setup() {
      console.error = vi.fn();
      console.info = vi.fn();
      console.log = vi.fn();
      console.warn = vi.fn();

      process.stdout.write = vi.fn();
      process.stderr.write = vi.fn();

      return () => {
        console.error = originalConsoleError;
        console.info = originalConsoleInfo;
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;

        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
      };
    },
  };
};

export const silenceLogsInBlock = () => {
  const silencer = createLogSilencer();

  let dispose: () => void | undefined;

  beforeEach(() => {
    dispose = silencer.setup();
  });
  afterEach(() => {
    dispose!();
  });
};

export const temporarilySilenceLogs =
  (testFn: () => Promise<void> | void) => async () => {
    const silencer = createLogSilencer();
    const dispose = silencer.setup();
    try {
      await testFn();
    } finally {
      dispose();
    }
  };

export type Fixture = FileTree;

export function stubIsTTY(value: boolean) {
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

function createTestFixture(dir?: Fixture) {
  return createFixture(dir, {
    fs: {
      ...fsp,
      rm: (path, options) => {
        return fsp.rm(path, {
          // make it more forgiving to fs contention
          // especially on Windows, given CI flakes we experienced caused by "EBUSY: resource busy or locked"
          maxRetries: 3,
          retryDelay: 100,
          ...options,
        });
      },
    },
  });
}

export async function testdir(dir?: Fixture) {
  const fixture = await createTestFixture(dir);
  onTestFinished(() => fixture.rm());
  return fixture.path;
}

function gitExec(cwd: string, signal?: AbortSignal) {
  return async (args: string[]) => {
    signal?.throwIfAborted();
    const result = await exec("git", args, { nodeOptions: { cwd, signal } });
    signal?.throwIfAborted();
    return result;
  };
}

// Git's background maintenance can race in the background with fixture cleanup by touching pack files so we disable it.
export async function disableGitBackgroundMaintenance(
  cwd: string,
  signal?: AbortSignal,
) {
  const git = gitExec(cwd, signal);
  await git(["config", "gc.auto", "0"]);
  await git(["config", "maintenance.auto", "false"]);
}

function gitFixtureFiles(dir: Fixture): Fixture {
  return { ".gitattributes": "* text=auto eol=lf\n", ...dir };
}

async function initializeGitdir(cwd: string, signal?: AbortSignal) {
  const git = gitExec(cwd, signal);
  await git(["init"]);
  await disableGitBackgroundMaintenance(cwd, signal);
  // so that this works regardless of what the default branch of git init is and for git versions that don't support --initial-branch(like our CI)
  {
    const { stdout } = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (stdout.trim() !== "main") {
      await git(["checkout", "-b", "main"]);
    }
  }

  const gitConfig = `
[user]
    email = x@y.z
    name = xyz
[commit]
    gpgSign = false
[tag]
    gpgSign = false
    forceSignAnnotated = false
  `.trim();
  await fsp.writeFile(path.join(cwd, ".git/config"), gitConfig, {
    encoding: "utf8",
    flag: "a",
    signal,
  });

  await git(["add", "."]);
  await git(["commit", "-m", "initial commit", "--allow-empty"]);
}

export async function gitdir(dir: Fixture) {
  const cwd = await testdir(gitFixtureFiles(dir));
  await initializeGitdir(cwd);
  return cwd;
}

export async function createDisposableGitdir(
  dir: Fixture,
  signal: AbortSignal,
  prepare?: (cwd: string) => Promise<void>,
) {
  signal.throwIfAborted();
  await using stack = new AsyncDisposableStack();
  const fixture = stack.use(await createTestFixture(gitFixtureFiles(dir)));
  await initializeGitdir(fixture.path, signal);
  await prepare?.(fixture.path);
  signal.throwIfAborted();
  const cleanup = stack.move();
  return {
    cwd: fixture.path,
    [Symbol.asyncDispose]: () => cleanup.disposeAsync(),
  };
}

export async function shallowClone(cwd: string, depth = 1) {
  const cloneDir = await testdir();
  await exec(
    "git",
    ["clone", "--depth", depth.toString(), pathToFileURL(cwd).toString(), "."],
    { nodeOptions: { cwd: cloneDir } },
  );
  await disableGitBackgroundMaintenance(cloneDir);
  return cloneDir;
}

export async function outputFile(
  filePath: string,
  content: string,
  encoding = "utf8" as fs.ObjectEncodingOptions,
) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, encoding);
}

export async function linkNodeModules(cwd: string) {
  await fsp.symlink(
    path.join(import.meta.dirname, "..", "..", "..", "node_modules"),
    path.join(cwd, "node_modules"),
  );
}
