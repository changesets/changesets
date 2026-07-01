import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { readChangesets as getChangesets } from "@changesets/read";
import {
  silenceLogsInBlock,
  testdir,
  gitdir,
  outputFile,
} from "@changesets/test-utils";
import * as clack from "@clack/prompts";
import { exec } from "tinyexec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { askWithEditor } from "../../../utils/askWithEditor.ts";
import * as utils from "../../../utils/cli-utilities.ts";
import { add as addChangeset } from "../index.ts";

vi.mock("../../../utils/askWithEditor");
const mockedAskWithEditor = vi.mocked(askWithEditor);
vi.mock("../../../utils/cli-utilities");
const mockedUtils = vi.mocked(utils);

const mockUserResponses = (mockResponses: {
  releases: Record<string, "patch" | "minor" | "major">;
  consoleSummaries?: readonly string[];
  editorSummaries?: readonly (string | number)[];
  summary?: string;
}) => {
  const summary = mockResponses.summary || "summary message mock";
  const majorReleases: Array<string> = [];
  const minorReleases: Array<string> = [];
  Object.entries(mockResponses.releases).forEach(([pkgName, type]) => {
    if (type === "major") {
      majorReleases.push(pkgName);
    } else if (type === "minor") {
      minorReleases.push(pkgName);
    }
  });
  let callCount = 0;
  const returnValues = [
    Object.keys(mockResponses.releases),
    majorReleases,
    minorReleases,
  ];
  mockedUtils.askMultiselect.mockImplementation(async () => {
    if (callCount === returnValues.length) {
      throw new Error(`There was an unexpected call to askMultiselect`);
    }
    return returnValues[callCount++];
  });

  if (
    mockResponses.consoleSummaries != null &&
    mockResponses.editorSummaries != null
  ) {
    for (let i = 0; i < mockResponses.consoleSummaries.length; i++) {
      const response = mockResponses.consoleSummaries[i];
      mockedUtils.askQuestion.mockResolvedValue(response);
    }
    for (let j = 0; j < mockResponses.editorSummaries.length; j++) {
      const response = mockResponses.editorSummaries[j];
      if (typeof response === "string") {
        mockedAskWithEditor.mockResolvedValueOnce(response);
      } else {
        mockedAskWithEditor.mockRejectedValueOnce(
          new Error("Editor cancelled"),
        );
      }
    }
  } else {
    mockedUtils.askQuestion.mockResolvedValue(summary);
  }
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("Add command", () => {
  silenceLogsInBlock();

  it("should generate changeset to patch a single package", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
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

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "summary message mock",
        releases: [{ name: "pkg-a", type: "patch" }],
      }),
    );
  });

  // prettier-ignore
  const cases = [
    // console                                editor                          expected
    [["summary on step 1"],                   [],                             "summary on step 1"],
    [[""],                                    ["summary in external editor"], "summary in external editor"],
    [["", "summary after editor cancelled"],  [""],                           "summary after editor cancelled"],
    [["", "summary after error"],             [1],                            "summary after error"],
  ] as const;
  it.each(cases)(
    "should read summary ($2)",
    async (consoleSummaries, editorSummaries, expectedSummary) => {
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

      mockUserResponses({
        releases: { "pkg-a": "patch" },
        consoleSummaries,
        editorSummaries,
      });
      await addChangeset({ cwd });

      const changesets = await getChangesets(cwd);
      expect(changesets.length).toBe(1);
      expect(changesets[0]).toEqual(
        expect.objectContaining({
          summary: expectedSummary,
          releases: [{ name: "pkg-a", type: "patch" }],
        }),
      );
    },
  );

  it("should generate a changeset in a single package repo", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "single-package",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    const summary = "summary message mock";
    mockedUtils.askList.mockResolvedValueOnce("minor");

    mockedUtils.askQuestion.mockResolvedValue("");
    mockedAskWithEditor.mockResolvedValueOnce(summary);

    await addChangeset({ cwd });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "summary message mock",
        releases: [{ name: "single-package", type: "minor" }],
      }),
    );
  });

  it("should commit when the commit flag is passed in", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...defaultConfig,
        commit: [
          path.resolve(
            import.meta.dirname,
            "..",
            "..",
            "..",
            "commit",
            "index.ts",
          ),
          null,
        ],
      }),
    });

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    const result = await exec("git", ["log", "--oneline", "-1"], {
      nodeOptions: { cwd },
    });
    expect(result.stdout.trim()).toContain(
      "docs(changeset): summary message mock",
    );
  });

  it("should create empty changeset when empty flag is passed in", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    await addChangeset({ cwd, empty: true });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        releases: [],
        summary: "",
      }),
    );
  });

  it("should use summary passed via message and keep confirmation flow", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "single-package",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockedUtils.askList.mockReturnValueOnce(Promise.resolve("minor"));

    await addChangeset({ cwd, message: "summary from message" });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "summary from message",
        releases: [{ name: "single-package", type: "minor" }],
      }),
    );
    expect(mockedUtils.askQuestion).not.toHaveBeenCalled();
    expect(mockedAskWithEditor).not.toHaveBeenCalled();
  });

  it("should allow empty summary when message is an empty string", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "single-package",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockedUtils.askList.mockReturnValueOnce(Promise.resolve("patch"));

    await addChangeset({ cwd, message: "" });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "",
        releases: [{ name: "single-package", type: "patch" }],
      }),
    );
    expect(mockedUtils.askQuestion).not.toHaveBeenCalled();
    expect(mockedAskWithEditor).not.toHaveBeenCalled();
  });

  it("should use summary passed via message in a monorepo and skip summary prompt", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
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

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd, message: "monorepo summary from message" });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "monorepo summary from message",
        releases: [{ name: "pkg-a", type: "patch" }],
      }),
    );
    expect(mockedUtils.askQuestion).not.toHaveBeenCalled();
    expect(mockedAskWithEditor).not.toHaveBeenCalled();
  });

  it("should allow using message with empty changesets", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    await addChangeset({
      cwd,
      empty: true,
      message: "empty changeset summary",
    });

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        releases: [],
        summary: "empty changeset summary",
      }),
    );
  });

  it("should detect changed packages since the given ref", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
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

    await exec("git", ["checkout", "-b", "foo"], { nodeOptions: { cwd } });
    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "a"',
    );
    await git.add(".", cwd);
    await git.commit("update pkg-a", cwd);

    await exec("git", ["checkout", "-b", "bar"], { nodeOptions: { cwd } });
    await outputFile(
      path.join(cwd, "packages/pkg-b/b.js"),
      'export default "b"',
    );
    await git.add(".", cwd);
    await git.commit("update pkg-b", cwd);

    mockUserResponses({ releases: { "pkg-b": "patch" } });
    await addChangeset({ cwd, empty: false, since: "foo" });

    expect(mockedUtils.askMultiselect).toHaveBeenCalledWith(
      expect.stringContaining("Which packages"),
      {
        "changed packages": [{ label: "pkg-b", value: "pkg-b" }],
        "unchanged packages": [{ label: "pkg-a", value: "pkg-a" }],
      },
      { required: true },
    );

    const changesets = await getChangesets(cwd);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "summary message mock",
        releases: [{ name: "pkg-b", type: "patch" }],
      }),
    );
  });

  it("should not include ignored packages in the prompt", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.3",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.2.0",
      }),
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "2.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...defaultConfig,
        ignore: ["pkg-b"],
      }),
    });

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });
    const choices =
      mockedUtils.askMultiselect.mock.calls[0][1]["unchanged packages"];
    expect(choices).toMatchObject([
      { label: "pkg-a", value: "pkg-a" },
      { label: "pkg-c", value: "pkg-c" },
    ]);
  });

  it("should not include private packages without a version in the prompt", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        private: true,
      }),
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });
    const choices =
      mockedUtils.askMultiselect.mock.calls[0][1]["unchanged packages"];
    expect(choices).toStrictEqual([
      { label: "pkg-a", value: "pkg-a" },
      { label: "pkg-c", value: "pkg-c" },
    ]);
  });

  it("should not include private packages with a version in the prompt if private packages are configured to be not versionable", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
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
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...defaultConfig,
        privatePackages: {
          version: false,
          tag: false,
        },
      }),
    });

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });
    const choices =
      mockedUtils.askMultiselect.mock.calls[0][1]["unchanged packages"];
    expect(choices).toStrictEqual([
      { label: "pkg-a", value: "pkg-a" },
      { label: "pkg-c", value: "pkg-c" },
    ]);
  });

  it("should exit with an error when there are no versionable packages in a single-package repo", async () => {
    const loggerErrorSpy = vi.spyOn(clack.log, "error");

    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "test-missing-version",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    await expect(() => addChangeset({ cwd })).rejects.toThrow(
      "The process exited with code: 1",
    );

    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const output = stripVTControlCharacters(loggerErrorSpy.mock.calls[0][0]);
    expect(output).toMatchInlineSnapshot(`
        "No versionable packages found
          Ensure the packages to version are not ignored by the config
          Ensure that relevant package.json files have a \`version\` field"
    `);
  });

  it("should exit with an error when there are no versionable packages in a monorepo", async () => {
    const loggerErrorSpy = vi.spyOn(clack.log, "error");

    const cwd = await testdir({
      "package.json": JSON.stringify({
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
      }),
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    await expect(() => addChangeset({ cwd })).rejects.toThrow(
      "The process exited with code: 1",
    );

    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const output = stripVTControlCharacters(loggerErrorSpy.mock.calls[0][0]);
    expect(output).toMatchInlineSnapshot(`
        "No versionable packages found
          Ensure the packages to version are not ignored by the config
          Ensure that relevant package.json files have a \`version\` field"
    `);
  });

  it("should validate package names passed in from release type flags", async () => {
    const loggerErrorSpy = vi.spyOn(clack.log, "error");

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

    await expect(() =>
      addChangeset({
        cwd,
        message: "test",
        major: ["pkg-missing-major"],
        minor: ["pkg-missing-minor"],
        patch: ["pkg-missing-patch"],
      }),
    ).rejects.toThrow("The process exited with code: 1");

    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const output = stripVTControlCharacters(loggerErrorSpy.mock.calls[0][0]);
    expect(output).toEqual(
      [
        "The package pkg-missing-major is passed to the `--major` option but it is not found in the project. You may have misspelled the package name.",
        "The package pkg-missing-minor is passed to the `--minor` option but it is not found in the project. You may have misspelled the package name.",
        "The package pkg-missing-patch is passed to the `--patch` option but it is not found in the project. You may have misspelled the package name.",
      ].join("\n"),
    );
  });

  it("should validate duplicate package names passed in from release type flags", async () => {
    const loggerErrorSpy = vi.spyOn(clack.log, "error");

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

    await expect(() =>
      addChangeset({
        cwd,
        message: "test",
        major: ["pkg-a"],
        minor: ["pkg-a"],
      }),
    ).rejects.toThrow("The process exited with code: 1");

    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const output = stripVTControlCharacters(loggerErrorSpy.mock.calls[0][0]);
    expect(output).toEqual(
      "The package pkg-a is passed to multiple release type options: `--major`, `--minor`. Please select only one release type for this package.",
    );
  });

  it("should not validate unknown package names as duplicates", async () => {
    const loggerErrorSpy = vi.spyOn(clack.log, "error");

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

    await expect(() =>
      addChangeset({
        cwd,
        message: "test",
        major: ["pkg-missing"],
        minor: ["pkg-missing"],
      }),
    ).rejects.toThrow("The process exited with code: 1");

    expect(loggerErrorSpy).toHaveBeenCalledOnce();
    const output = stripVTControlCharacters(loggerErrorSpy.mock.calls[0][0]);
    expect(output).toEqual(
      [
        "The package pkg-missing is passed to the `--major` option but it is not found in the project. You may have misspelled the package name.",
        "The package pkg-missing is passed to the `--minor` option but it is not found in the project. You may have misspelled the package name.",
      ].join("\n"),
    );
  });

  it("should be able to add a changeset when called from subdirectory", async () => {
    const rootDir = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
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

    const cwd = path.resolve(rootDir, "packages", "pkg-a");

    mockUserResponses({ releases: { "pkg-a": "patch" } });
    await addChangeset({ cwd });

    const changesets = await getChangesets(rootDir);
    expect(changesets.length).toBe(1);
    expect(changesets[0]).toEqual(
      expect.objectContaining({
        summary: "summary message mock",
        releases: [{ name: "pkg-a", type: "patch" }],
      }),
    );
  });

  it("should throw when .changeset folder is missing when called from subdirectory", async () => {
    const loggerErrorSpy = vi.spyOn(clack.log, "error");

    const rootDir = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const cwd = path.resolve(rootDir, "packages", "pkg-a");

    try {
      await addChangeset({ cwd, message: "test" });
    } catch {
      // ignore the error. We just want to validate the error message
    }

    const arg = loggerErrorSpy.mock.calls[0][0];
    expect(stripVTControlCharacters(arg)).toEqual(
      expect.stringContaining("There is no .changeset folder."),
    );
  });
});
