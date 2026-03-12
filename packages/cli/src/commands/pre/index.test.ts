import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "path";
import { ExitError } from "@changesets/errors";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { log } from "@clack/prompts";

import pre from "./index.ts";

vi.mock("@clack/prompts");
const mockedLogger = vi.mocked(log);

silenceLogsInBlock();

describe("enterPre", () => {
  it("should enter", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
    });
    await pre(cwd, { command: "enter", tag: "next" });

    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset", "pre.json"), "utf8"),
      ),
    ).toMatchObject({
      changesets: [],
      initialVersions: {},
      mode: "pre",
      tag: "next",
    });
    expect(mockedLogger.success).toHaveBeenCalledWith(
      expect.stringContaining("Entered pre mode with tag"),
    );
    expect(mockedLogger.success).toHaveBeenCalledWith(
      expect.stringContaining("next"),
    );
  });
  it("should throw if already in pre", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/pre.json": JSON.stringify({
        changesets: [],
        initialVersions: {},
        mode: "pre",
        tag: "next",
      }),
    });

    await expect(
      pre(cwd, { command: "enter", tag: "next" }),
    ).rejects.toBeInstanceOf(ExitError);
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("changeset pre enter"),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("cannot be run when in pre mode"),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("If you're trying to exit"),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("changeset pre exit"),
    );
  });
  it("should enter if already exited pre mode", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/pre.json": JSON.stringify({
        changesets: [],
        initialVersions: {},
        mode: "exit",
        tag: "beta",
      }),
    });

    await pre(cwd, { command: "enter", tag: "next" });
    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset", "pre.json"), "utf8"),
      ),
    ).toEqual({
      changesets: [],
      initialVersions: {},
      mode: "pre",
      tag: "next",
    });
    expect(mockedLogger.success).toHaveBeenCalledWith(
      expect.stringContaining("Entered pre mode with tag"),
    );
    expect(mockedLogger.success).toHaveBeenCalledWith(
      expect.stringContaining("next"),
    );
  });
});

describe("exitPre", () => {
  it("should exit", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/pre.json": JSON.stringify({
        changesets: [],
        initialVersions: {},
        mode: "pre",
        tag: "next",
      }),
    });
    await pre(cwd, { command: "exit" });

    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset", "pre.json"), "utf8"),
      ),
    ).toEqual({
      changesets: [],
      initialVersions: {},
      mode: "exit",
      tag: "next",
    });
  });
  it("should throw if not in pre", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
    });
    await expect(pre(cwd, { command: "exit" })).rejects.toBeInstanceOf(
      ExitError,
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("changeset pre exit"),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("can only be run when in pre mode"),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("If you're trying to enter pre mode, run "),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("changeset pre enter"),
    );
  });
});
