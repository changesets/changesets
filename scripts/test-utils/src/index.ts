import type fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createFixture, type FileTree } from "fs-fixture";
import { exec } from "tinyexec";
import { afterEach, beforeEach, type Mock, onTestFinished, vi } from "vitest";

type PartialMockMethods<T> = Partial<{
  [K in keyof T as T[K] extends (...args: never) => unknown
    ? K
    : never]: T[K] extends (...args: never) => unknown ? Mock<T[K]> : never;
}>;

export const mockedLogger: PartialMockMethods<
  typeof import("@changesets/logger")
> = {};

vi.mock("@changesets/logger", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    prefix: mod.prefix,
    error: (...args) => (mockedLogger.error ?? mod.error)(...args),
    info: (...args) => (mockedLogger.info ?? mod.info)(...args),
    log: (...args) => (mockedLogger.log ?? mod.log)(...args),
    warn: (...args) => (mockedLogger.warn ?? mod.warn)(...args),
    success: (...args) => (mockedLogger.success ?? mod.success)(...args),
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
      mockedLogger.error = vi.fn();
      mockedLogger.info = vi.fn();
      mockedLogger.log = vi.fn();
      mockedLogger.warn = vi.fn();
      mockedLogger.success = vi.fn();

      console.error = vi.fn();
      console.info = vi.fn();
      console.log = vi.fn();
      console.warn = vi.fn();

      process.stdout.write = vi.fn();
      process.stderr.write = vi.fn();

      return () => {
        mockedLogger.error = undefined;
        mockedLogger.info = undefined;
        mockedLogger.log = undefined;
        mockedLogger.warn = undefined;
        mockedLogger.success = undefined;

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

export async function testdir(dir?: Fixture) {
  const fixture = await createFixture(dir);
  onTestFinished(() => fixture.rm());
  return fixture.path;
}

export async function gitdir(dir: Fixture) {
  const cwd = await testdir(dir);

  await exec("git", ["init"], { nodeOptions: { cwd } });
  // so that this works regardless of what the default branch of git init is and for git versions that don't support --initial-branch(like our CI)
  {
    const { stdout } = await exec(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { nodeOptions: { cwd } },
    );
    if (stdout.trim() !== "main") {
      await exec("git", ["checkout", "-b", "main"], { nodeOptions: { cwd } });
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
  await fsp.appendFile(path.join(cwd, ".git/config"), gitConfig, "utf8");

  await exec("git", ["add", "."], { nodeOptions: { cwd } });
  await exec("git", ["commit", "-m", "initial commit", "--allow-empty"], {
    nodeOptions: { cwd },
  });

  return cwd;
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
