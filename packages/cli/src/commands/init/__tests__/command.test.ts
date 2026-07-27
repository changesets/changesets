import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultWrittenConfig } from "@changesets/config";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cli from "../../../utils/cli-utilities.ts";
import { init as initializeCommand } from "../index.ts";

vi.mock("../../../utils/cli-utilities.ts");
const mockedUtils = vi.mocked(cli);

const getPaths = (cwd: string) => ({
  readmePath: path.join(cwd, ".changeset/README.md"),
  configPath: path.join(cwd, ".changeset/config.json"),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();

  mockedUtils.askList.mockImplementation(async (message) => {
    if (message.includes("published")) {
      return "restricted";
    }
    return "";
  });

  mockedUtils.askConfirm.mockImplementation(async (message) => {
    if (message.includes("GitHub integration")) {
      return false;
    }
    if (message.includes("automatically committed")) {
      return false;
    }
    return false;
  });

  mockedUtils.askQuestion.mockImplementation(async (message) => {
    if (message.includes("GitHub repository")) {
      return "changesets/changesets";
    }
    if (message.includes("base branch")) {
      return "";
    }
    return "";
  });
});

describe("init", () => {
  silenceLogsInBlock();

  it("should be initialized in a project without a .changeset folder", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
    });
    const { readmePath, configPath } = getPaths(cwd);

    expect(existsSync(readmePath)).toBe(false);
    expect(existsSync(configPath)).toBe(false);

    await initializeCommand({ cwd });

    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(configPath)).toBe(true);
  });

  it("should use process.cwd() if options are not provided", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
    });

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(cwd);
    const { readmePath, configPath } = getPaths(cwd);

    expect(existsSync(readmePath)).toBe(false);
    expect(existsSync(configPath)).toBe(false);

    await initializeCommand();

    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(configPath)).toBe(true);

    cwdSpy.mockRestore();
  });

  it("should be written with the default config if it doesn't exist", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
    });

    await initializeCommand({ cwd });
    const { readmePath, configPath } = getPaths(cwd);

    expect(existsSync(readmePath)).toBe(true);
    expect(JSON.parse(await fs.readFile(configPath, "utf8"))).toEqual(
      defaultWrittenConfig,
    );
  });

  it("should be written with the config and README if the .changeset folder already exists but is empty", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
      ".changeset": {},
    });

    const { readmePath, configPath } = getPaths(cwd);
    expect(existsSync(readmePath)).toBe(false);
    expect(existsSync(configPath)).toBe(false);

    await initializeCommand({ cwd });

    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(configPath)).toBe(true);
  });

  it("should not overwrite README.md if it already exists and config.json is missing", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
      ".changeset/README.md": "custom readme content",
    });

    const { readmePath, configPath } = getPaths(cwd);
    expect(existsSync(readmePath)).toBe(true);
    expect(existsSync(configPath)).toBe(false);

    await initializeCommand({ cwd });

    expect(existsSync(configPath)).toBe(true);
    const readmeContent = await fs.readFile(readmePath, "utf8");
    expect(readmeContent).toBe("custom readme content");
  });

  it("should be appended with a newline at the end of the config", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
    });

    await initializeCommand({ cwd });

    const { configPath } = getPaths(cwd);
    const config = (await fs.readFile(configPath)).toString();
    const lastCharacter = config.slice(-1);

    expect(lastCharacter).toBe("\n");
  });

  it("should not be overwritten if a config already exists", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({
        changelog: false,
      }),
    });

    await initializeCommand({ cwd });

    const { configPath } = getPaths(cwd);
    expect(JSON.parse(await fs.readFile(configPath, "utf8"))).toEqual({
      changelog: false,
    });
  });

  it("should be written with GitHub changelog config and prompt for repo when chosen", async () => {
    mockedUtils.askConfirm.mockImplementation(async (message) => {
      if (message.includes("GitHub integration")) {
        return true;
      }
      return false;
    });

    mockedUtils.askQuestion.mockImplementation(async (message) => {
      if (message.includes("GitHub repository")) {
        return "my-org/my-repo";
      }
      return "";
    });

    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
    });

    await initializeCommand({ cwd });

    const { readmePath, configPath } = getPaths(cwd);
    const config = JSON.parse(await fs.readFile(configPath, "utf8"));

    expect(existsSync(readmePath)).toBe(true);
    expect(config.changelog).toEqual([
      "@changesets/changelog-github",
      { repo: "my-org/my-repo" },
    ]);
  });

  it("should be written with public access, commit enabled, and custom branch when chosen", async () => {
    mockedUtils.askConfirm.mockResolvedValue(true);
    mockedUtils.askList.mockImplementation(async (message) => {
      if (message.includes("published")) {
        return "public";
      }
      return "";
    });
    mockedUtils.askQuestion.mockImplementation(async (message) => {
      if (message.includes("base branch")) {
        return "master";
      }
      return "";
    });

    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
    });

    await initializeCommand({ cwd });

    const { configPath } = getPaths(cwd);
    const config = JSON.parse(await fs.readFile(configPath, "utf8"));

    expect(config.commit).toBe(true);
    expect(config.access).toBe("public");
    expect(config.baseBranch).toBe("master");
  });

  it("should be fallen back to main branch when an empty string is provided", async () => {
    mockedUtils.askQuestion.mockImplementation(async (message) => {
      if (message.includes("base branch")) {
        return "";
      }
      return "";
    });

    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
    });

    await initializeCommand({ cwd });

    const { configPath } = getPaths(cwd);
    const config = JSON.parse(await fs.readFile(configPath, "utf8"));

    expect(config.baseBranch).toBe("main");
  });

  it("should be written with consistently ordered properties", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
      }),
    });

    await initializeCommand({ cwd });

    const { configPath } = getPaths(cwd);
    const configContent = await fs.readFile(configPath, "utf8");
    const parsedConfig = JSON.parse(configContent);
    const keys = Object.keys(parsedConfig);

    expect(keys).toEqual([
      "$schema",
      "baseBranch",
      "access",
      "format",
      "changelog",
      "commit",
      "ignore",
      "fixed",
      "linked",
      "updateInternalDependencies",
      "stagedPublishing",
    ]);
  });
});
