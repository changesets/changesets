import { afterEach, beforeEach, vi } from "vitest";
import * as clack from "@clack/prompts";
import fixturez from "fixturez";
import { exec } from "tinyexec";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export const mockedLogger = vi.mocked(clack);

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

let f = fixturez(import.meta.dirname);

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
  await exec("git", ["config", "user.email", "x@y.z"], {
    nodeOptions: { cwd },
  });
  await exec("git", ["config", "user.name", "xyz"], { nodeOptions: { cwd } });
  await exec("git", ["config", "commit.gpgSign", "false"], {
    nodeOptions: { cwd },
  });
  await exec("git", ["config", "tag.gpgSign", "false"], {
    nodeOptions: { cwd },
  });
  await exec("git", ["config", "tag.forceSignAnnotated", "false"], {
    nodeOptions: { cwd },
  });

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
