import { Mock, vi } from "vitest";
import fixturez from "fixturez";
import spawn from "spawndamnit";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PartialMockMethods<T> = Partial<{
  [K in keyof T as T[K] extends (...args: never) => unknown
    ? K
    : never]: T[K] extends (...args: never) => unknown ? Mock<T[K]> : never;
}>;

export const mockedLogger: PartialMockMethods<
  typeof import("@changesets/logger")
> = {};

vi.mock(import("@changesets/logger"), async (importOriginal) => {
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

let f = fixturez(__dirname);

export interface Fixture extends Record<string, string> {}

export async function testdir(dir: Fixture) {
  const temp = f.temp();
  await Promise.all(
    Object.keys(dir).map(async (filename) => {
      const fullPath = path.join(temp, filename);
      await fsp.mkdir(path.dirname(fullPath), { recursive: true });
      await fsp.writeFile(fullPath, dir[filename]);
    }),
  );
  return temp;
}

export const tempdir = f.temp;

export async function gitdir(dir: Fixture) {
  const cwd = await testdir(dir);
  await spawn("git", ["init"], { cwd });
  // so that this works regardless of what the default branch of git init is and for git versions that don't support --initial-branch(like our CI)
  {
    const { stdout } = await spawn(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd },
    );
    if (stdout.toString("utf8").trim() !== "main") {
      await spawn("git", ["checkout", "-b", "main"], { cwd });
    }
  }
  await spawn("git", ["config", "user.email", "x@y.z"], { cwd });
  await spawn("git", ["config", "user.name", "xyz"], { cwd });
  await spawn("git", ["config", "commit.gpgSign", "false"], { cwd });
  await spawn("git", ["config", "tag.gpgSign", "false"], { cwd });
  await spawn("git", ["config", "tag.forceSignAnnotated", "false"], {
    cwd,
  });

  await spawn("git", ["add", "."], { cwd });
  await spawn("git", ["commit", "-m", "initial commit", "--allow-empty"], {
    cwd,
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

// `fs.exists` is deprecated, and Node recommends this for asynchronous existence checks.
export async function pathExists(p: string) {
  return fsp.access(p).then(
    () => true,
    () => false,
  );
}

export async function linkNodeModules(cwd: string) {
  await fsp.symlink(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "node_modules",
    ),
    path.join(cwd, "node_modules"),
  );
}
