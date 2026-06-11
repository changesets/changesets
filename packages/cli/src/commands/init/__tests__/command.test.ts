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
    if (message.includes("changelog")) {
      return "@changesets/cli/changelog";
    }
    if (message.includes("published")) {
      return "restricted";
    }
    return "";
  });

  mockedUtils.askConfirm.mockResolvedValue(false);

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
    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset/config.json"), "utf8"),
      ),
    ).toEqual(defaultWrittenConfig);
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

    const configPath = path.join(cwd, ".changeset/config.json");
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
    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset/config.json"), "utf8"),
      ),
    ).toEqual({
      changelog: false,
    });
  });

  it("should be written with GitHub changelog config and prompt for repo when chosen", async () => {
    mockedUtils.askList.mockImplementation(async (message) => {
      if (message.includes("changelog")) {
        return "@changesets/changelog-github";
      }
      if (message.includes("published")) {
        return "restricted";
      }
      return "";
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
    const config = JSON.parse(
      await fs.readFile(path.join(cwd, ".changeset/config.json"), "utf8"),
    );

    expect(config.changelog).toEqual([
      "@changesets/changelog-github",
      { repo: "my-org/my-repo" },
    ]);
  });

  it("should be written with Git changelog config when chosen", async () => {
    mockedUtils.askList.mockImplementation(async (message) => {
      if (message.includes("changelog")) {
        return "@changesets/changelog-git";
      }
      if (message.includes("published")) {
        return "restricted";
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
    const config = JSON.parse(
      await fs.readFile(path.join(cwd, ".changeset/config.json"), "utf8"),
    );

    expect(config.changelog).toEqual("@changesets/changelog-git");
  });

  it("should be written with public access, commit enabled, and custom branch when chosen", async () => {
    mockedUtils.askConfirm.mockResolvedValue(true);
    mockedUtils.askList.mockImplementation(async (message) => {
      if (message.includes("changelog")) {
        return "@changesets/cli/changelog";
      }
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
    const config = JSON.parse(
      await fs.readFile(path.join(cwd, ".changeset/config.json"), "utf8"),
    );

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
    const config = JSON.parse(
      await fs.readFile(path.join(cwd, ".changeset/config.json"), "utf8"),
    );

    expect(config.baseBranch).toBe("main");
  });
});
