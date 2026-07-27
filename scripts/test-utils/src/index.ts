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

export async function testdir(dir?: Fixture) {
  const fixture = await createFixture(dir);
  onTestFinished(() => fixture.rm());
  return fixture.path;
}

// Git's background maintenance can race in the background with fixture cleanup by touching pack files so we disable it.
export async function disableGitBackgroundMaintenance(cwd: string) {
  await exec("git", ["config", "gc.auto", "0"], { nodeOptions: { cwd } });
  await exec("git", ["config", "maintenance.auto", "false"], {
    nodeOptions: { cwd },
  });
}

export async function gitdir(dir: Fixture) {
  const cwd = await testdir({
    ".gitattributes": "* text=auto eol=lf\n",
    ...dir,
  });

  await exec("git", ["init"], { nodeOptions: { cwd } });
  await disableGitBackgroundMaintenance(cwd);
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
