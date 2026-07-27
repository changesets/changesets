import fs from "node:fs/promises";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { defaultConfig } from "@changesets/config";
import { ExitError } from "@changesets/errors";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import type { Changeset, Config } from "@changesets/types";
import { writeChangeset } from "@changesets/write";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { humanId } from "human-id";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { pre } from "../pre/index.ts";
import { version } from "./index.ts";

vi.mock("@clack/prompts");
const mockedLogger = vi.mocked(log);

const modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: ["@changesets/cli/changelog", null],
};

vi.mock("human-id");

vi.mock("@changesets/git");
const mockedGit = vi.mocked(git);
mockedGit.add.mockImplementation(async () => true);
mockedGit.commit.mockImplementation(async () => true);
mockedGit.getCommitsThatAddFiles.mockImplementation(async (changesetIds) =>
  changesetIds.map(() => "g1th4sh"),
);
mockedGit.getCurrentCommitId.mockImplementation(
  async () => "abcdefghijklmnopqrstuvwxyz",
);
mockedGit.tag.mockImplementation(async () => true);

const writeChangesets = (changesets: Changeset[], cwd: string) => {
  return Promise.all(
    changesets.map((changeset) => writeChangeset(changeset, cwd)),
  );
};

const getFilePath = async (pkgName: string, fileName: string, cwd: string) => {
  const packages = await getPackages(cwd);
  const pkg = packages.packages.find((pkg) => pkg.packageJson.name === pkgName);
  expect(pkg).toBeDefined();
  return path.join(pkg!.dir, fileName);
};

const getFile = async (pkgName: string, fileName: string, cwd: string) => {
  return fs.readFile(await getFilePath(pkgName, fileName, cwd), "utf8");
};

const getPkgJSON = async (pkgName: string, cwd: string) => {
  return JSON.parse(await getFile(pkgName, "package.json", cwd));
};

const getChangelog = async (pkgName: string, cwd: string) => {
  return getFile(pkgName, "CHANGELOG.md", cwd);
};

beforeEach(() => {
  let i = 0;
  (humanId as Mock<() => string>).mockImplementation(() => {
    return `some-id-${i++}`;
  });

  console.error = vi.fn();

  vi.setSystemTime(vi.getRealSystemTime());
});

silenceLogsInBlock();

describe("running version in a simple project", () => {
  describe("when there are no changeset commits", () => {
    it("should warn and exit with code 1 if no changeset commits exist", async () => {
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
        ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      });
      await expect(version({ cwd })).rejects.toThrow(ExitError);
      expect(mockedLogger.warn).toHaveBeenCalledExactlyOnceWith(
        "No unreleased changesets found.",
      );
    });
  });

  it("should validate package name passed in from --ignore flag", async () => {
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
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await expect(version({ cwd, ignore: ["pkg-c"] })).rejects.toThrow(
      ExitError,
    );

    expect(mockedLogger.error).toHaveBeenCalledOnce();
    const arg = mockedLogger.error.mock.calls[0][0];
    expect(stripVTControlCharacters(arg)).toEqual(
      `The package pkg-c is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`,
    );
  });

  it("should throw if dependents of ignored packages are not explicitly listed in the ignore array", async () => {
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
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await expect(version({ cwd, ignore: ["pkg-b"] })).rejects.toThrow(
      ExitError,
    );

    expect(mockedLogger.error).toHaveBeenCalledOnce();
    const arg = mockedLogger.error.mock.calls[0][0];
    expect(stripVTControlCharacters(arg)).toEqual(
      `The package pkg-a depends on the skipped package pkg-b (either by \`ignore\` option or by \`privatePackages.version\`), but pkg-a is not being skipped. Please pass pkg-a to the --ignore flag.`,
    );
  });

  it("should throw if `--ignore` flag is used while ignore array is also defined in the config file", async () => {
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
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ignore: ["pkg-a"],
      }),
    });

    await expect(version({ cwd, ignore: ["pkg-b"] })).rejects.toThrow(
      ExitError,
    );

    expect(mockedLogger.error).toHaveBeenCalledOnce();
    const arg = mockedLogger.error.mock.calls[0][0];
    expect(stripVTControlCharacters(arg)).toEqual(
      `It looks like you are trying to use the \`--ignore\` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.`,
    );
  });

  describe("when there is a changeset commit", () => {
    it("should bump releasedPackages", async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      });
      await writeChangesets(
        [
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );

      await version({ cwd });

      expect(await getPkgJSON("pkg-a", cwd)).toEqual(
        expect.objectContaining({ name: "pkg-a", version: "1.1.0" }),
      );
      expect(await getPkgJSON("pkg-b", cwd)).toEqual(
        expect.objectContaining({ name: "pkg-b", version: "1.0.1" }),
      );
    });
  });

  it("should not touch package.json of an ignored package when it is not a dependent of any releasedPackages", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ignore: ["pkg-a"],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    // no change
    expect(await getPkgJSON("pkg-a", cwd)).toEqual({
      name: "pkg-a",
      version: "1.0.0",
      dependencies: {
        "pkg-b": "1.0.0",
      },
    });
  });

  it("should not bump ignored packages", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ignore: ["pkg-a"],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
        {
          summary: "This is not a summary",
          releases: [{ name: "pkg-b", type: "patch" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "1.0.1",
          },
          "name": "pkg-a",
          "version": "1.0.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1",
        },
      ]
    `);
  });

  it("should not commit the result if commit config is not set", async () => {
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
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ],
      cwd,
    );
    const spy = vi.spyOn(git, "commit");

    await version({ cwd });

    expect(spy).not.toHaveBeenCalled();
  });

  it("should git add the expected files if commit config is set", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        commit: ["@changesets/cli/commit", null],
      }),
    });

    const ids = await writeChangesets(
      [
        {
          summary: "This is a summary too",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "patch" },
          ],
        },
      ],
      cwd,
    );
    const spy = vi.spyOn(git, "add");

    expect(spy).not.toHaveBeenCalled();

    await version({ cwd });

    expect(spy).toHaveBeenCalled();

    expect(spy).toHaveBeenCalledWith(
      path.join("packages", "pkg-a", "package.json"),
      cwd,
    );
    expect(spy).toHaveBeenCalledWith(
      path.join("packages", "pkg-a", "CHANGELOG.md"),
      cwd,
    );

    expect(spy).toHaveBeenCalledWith(
      path.join("packages", "pkg-b", "package.json"),
      cwd,
    );
    expect(spy).toHaveBeenCalledWith(
      path.join("packages", "pkg-b", "CHANGELOG.md"),
      cwd,
    );

    expect(spy).toHaveBeenCalledWith(
      path.join(".changeset", `${ids[0]}.md`),
      cwd,
    );
  });

  it("should commit the result if commit config is set", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        commit: ["@changesets/cli/commit", null],
      }),
    });

    await writeChangesets(
      [
        {
          summary: "This is a summary too",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "patch" },
          ],
        },
      ],
      cwd,
    );
    const spy = vi.spyOn(git, "commit");

    expect(spy).not.toHaveBeenCalled();

    await version({ cwd });

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(`
      "RELEASING: Releasing 2 package(s)

      Releases:
        pkg-a@1.1.0
        pkg-b@1.0.1
      "
    `);
  });

  it("should skip over ignored changesets", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      ".changeset/changesets-are-beautiful.md": `---
"pkg-a": minor
---

Nice simple summary, much wow
`,
      ".changeset/.ignored-temporarily.md": `---
"pkg-b": minor
---

Awesome feature, hidden behind a feature flag
`,
    });

    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "1.0.0",
        },
      },
      {
        name: "pkg-b",
        version: "1.0.0",
      },
    ]);

    const changesetDir = await fs.readdir(path.join(cwd, ".changeset"));
    // should still contain the ignored changeset
    expect(changesetDir).toContain(".ignored-temporarily.md");
  });

  it("should not update a dependant that uses a tag as a dependency rage for a package that could otherwise be local", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["examples/*", "packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "examples/example-a/package.json": JSON.stringify({
        name: "example-a",
        version: "1.0.0",
        dependencies: {
          "pkg-a": "latest",
        },
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "major" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-a": "latest",
          },
          "name": "example-a",
          "version": "1.0.0",
        },
        {
          "name": "pkg-a",
          "version": "2.0.0",
        },
      ]
    `);
  });

  it("should ignore special string replacement patterns in appended changesets", async () => {
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
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      "packages/pkg-a/CHANGELOG.md": `# pkg-a

      ## 1.0.0

      ### Major Changes

      - a very useful summary for the change
      `,
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "major" }],
        summary: "a summary with special replacement patterns `react$` $'",
      },
      cwd,
    );

    await version({ cwd });

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 2.0.0

      ### Major Changes

      - g1th4sh: a summary with special replacement patterns \`react$\` $'

            ## 1.0.0

            ### Major Changes

            - a very useful summary for the change
            "
    `);
  });

  describe("when there are multiple changeset commits", () => {
    it("should bump releasedPackages", async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      });
      await writeChangesets(
        [
          {
            summary: "This is a summary",
            releases: [{ name: "pkg-a", type: "minor" }],
          },
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );

      await version({ cwd });

      expect(await getPkgJSON("pkg-a", cwd)).toEqual(
        expect.objectContaining({ name: "pkg-a", version: "1.1.0" }),
      );
      expect(await getPkgJSON("pkg-b", cwd)).toEqual(
        expect.objectContaining({ name: "pkg-b", version: "1.0.1" }),
      );
    });

    it("should bump multiple released packages if required", async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      });
      await writeChangesets(
        [
          {
            summary: "This is a summary",
            releases: [{ name: "pkg-a", type: "minor" }],
          },
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );
      await version({ cwd });

      // first call should be minor bump
      expect(await getPkgJSON("pkg-a", cwd)).toEqual(
        expect.objectContaining({
          name: "pkg-a",
          version: "1.1.0",
        }),
      );
      // second should be a patch
      expect(await getPkgJSON("pkg-b", cwd)).toEqual(
        expect.objectContaining({
          name: "pkg-b",
          version: "1.0.1",
        }),
      );
    });
    it("should delete the changeset files", async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
      });

      await writeChangesets(
        [
          {
            summary: "This is a summary",
            releases: [{ name: "pkg-a", type: "minor" }],
          },
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );
      expect((await fs.readdir(path.resolve(cwd, ".changeset"))).length).toBe(
        3,
      );

      await version({ cwd });
      expect((await fs.readdir(path.resolve(cwd, ".changeset"))).length).toBe(
        1,
      );
    });
  });
});

describe("fixed", () => {
  it("should bump packages to the correct versions when packages are fixed", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        fixed: [["pkg-a", "pkg-b"]],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({ name: "pkg-a", version: "1.1.0" }),
    );
    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({ name: "pkg-b", version: "1.1.0" }),
    );
  });

  it("should not bump an ignored fixed package that depends on a package from the group that is being released", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        fixed: [["pkg-a", "pkg-b"]],
        ignore: ["pkg-a"],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is not a summary",
          releases: [{ name: "pkg-b", type: "patch" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "1.0.1",
          },
          "name": "pkg-a",
          "version": "1.0.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1",
        },
      ]
    `);
  });

  it("should update CHANGELOGs of all packages from the fixed group", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        fixed: [["pkg-a", "pkg-b"]],
      }),
    });

    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary

      ### Patch Changes

      - pkg-b@1.1.0
      "
    `);
    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.1.0
      "
    `);

    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.2.0

      ### Minor Changes

      - g1th4sh: This is a summary

      ### Patch Changes

      - pkg-b@1.2.0

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary

      ### Patch Changes

      - pkg-b@1.1.0
      "
    `);
    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.2.0

      ## 1.1.0
      "
    `);
  });
});

describe("linked", () => {
  it("should bump packages to the correct versions when packages are linked", async () => {
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
        dependencies: {
          "pkg-b": "0.1.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "0.1.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        linked: [["pkg-a", "pkg-b"]],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary too",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "patch" },
          ],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({ name: "pkg-a", version: "1.1.0" }),
    );
    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({ name: "pkg-b", version: "1.1.0" }),
    );
  });

  it("should not break when there is a linked package without a changeset", async () => {
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
        dependencies: {
          "pkg-b": "0.1.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "0.1.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        linked: [["pkg-a", "pkg-b"]],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ],
      cwd,
    );

    await version({ cwd });

    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({ name: "pkg-a", version: "1.1.0" }),
    );
  });
});

describe("workspace range", () => {
  it("should update dependency range correctly", async () => {
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
        dependencies: {
          "pkg-b": "workspace:1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        commit: false,
      }),
    });

    await writeChangesets(
      [
        {
          summary: "This is a summary too",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "patch" },
          ],
        },
      ],
      cwd,
    );
    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:1.0.1",
        },
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
  });

  it("should bump dependent package when bumping a `workspace:*` dependency", async () => {
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
        dependencies: {
          "pkg-b": "workspace:*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );
    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.0.1",
        dependencies: {
          "pkg-b": "workspace:*",
        },
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
  });

  it("should update root package.json references to bumped workspace packages", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
        devDependencies: {
          "pkg-b": "workspace:^1.0.0",
        },
      }),
      "package-lock.json": "",
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "minor" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );
    await version({ cwd });

    const rootPackageJson = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf8"),
    );
    expect(rootPackageJson).toEqual({
      private: true,
      name: "root-pkg",
      workspaces: ["packages/*"],
      devDependencies: {
        "pkg-b": "workspace:^1.1.0",
      },
    });
  });

  it("should not bump dependent package when patch bumping a `workspace:^` dependency", async () => {
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
        dependencies: {
          "pkg-b": "workspace:^",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );
    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.0.0",
        dependencies: {
          "pkg-b": "workspace:^",
        },
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
  });

  it("should bump dependent package when minor bumping a `workspace:~` dependency", async () => {
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
        dependencies: {
          "pkg-b": "workspace:~",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "minor" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );
    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.0.1",
        dependencies: {
          "pkg-b": "workspace:~",
        },
      },
      {
        name: "pkg-b",
        version: "1.1.0",
      },
    ]);
  });

  it("should update dependant CHANGELOGs with 'Dependency update' information", async () => {
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
        dependencies: { "pkg-a": "workspace:*" },
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
          updateInternalDependents: "always",
        },
      }),
    });

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await version({ cwd });

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary
      "
    `);

    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.0.1

      ### Patch Changes

      - Updated dependencies [g1th4sh]
        - pkg-a@1.1.0
      "
    `);
  });

  it("should patch bump peer-dependent when workspace:~ dependency gets a minor bump (without onlyUpdatePeerDependentsWhenOutOfRange)", async () => {
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
        peerDependencies: { "pkg-a": "workspace:~" },
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await version({ cwd });

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary
      "
    `);

    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.0.1

      ### Patch Changes

      - Updated dependencies [g1th4sh]
        - pkg-a@1.1.0
      "
    `);
  });

  it("should not bump peer-dependent when workspace:~ dependency gets a minor bump (with onlyUpdatePeerDependentsWhenOutOfRange)", async () => {
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
        peerDependencies: { "pkg-a": "workspace:^" },
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
          onlyUpdatePeerDependentsWhenOutOfRange: true,
        },
      }),
    });

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await version({ cwd });

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary
      "
    `);

    // `pkg-b` should not be touched
    await expect(() => getChangelog("pkg-b", cwd)).rejects.toThrow();
  });
});

describe("same package in different dependency types", () => {
  it("should update different range types correctly", async () => {
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
        peerDependencies: {
          "pkg-b": "^1.0.0",
        },
        devDependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await writeChangeset(
      {
        releases: [
          {
            name: "pkg-b",
            type: "patch",
          },
        ],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        devDependencies: {
          "pkg-b": "1.0.1",
        },
        peerDependencies: {
          "pkg-b": "^1.0.1",
        },
        name: "pkg-a",
        version: "1.0.0",
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
  });
});

describe("snapshot release", () => {
  it("should update the package to unique version no matter the kind of version bump it is", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        commit: false,
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary too",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "patch" },
          ],
        },
      ],
      cwd,
    );
    await version({ cwd, snapshot: "experimental" });
    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-a",
        version: expect.stringContaining("0.0.0-experimental-"),
      }),
    );

    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-b",
        version: expect.stringContaining("0.0.0-experimental-"),
      }),
    );
  });

  it("should not commit the result even if commit config is set", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        commit: ["@changesets/cli/commit", null],
      }),
    });
    await writeChangesets(
      [
        {
          summary: "This is a summary too",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "patch" },
          ],
        },
      ],
      cwd,
    );
    const spy = vi.spyOn(git, "commit");

    expect(spy).not.toHaveBeenCalled();

    await version({ cwd, snapshot: "experimental" });

    expect(spy).not.toHaveBeenCalled();
  });

  it("should not bump version of a package with an explicit none release type", async () => {
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
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "none" }],
        summary: "some internal stuff",
      },
      cwd,
    );

    await version({ cwd, snapshot: true });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "name": "pkg-a",
          "version": "1.0.0",
        },
      ]
    `);
  });

  it("should not bump version of an ignored package when its dependency gets updated", async () => {
    vi.setSystemTime("2021-12-13T00:07:30.879Z");

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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ignore: ["pkg-a"],
      }),
    });
    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "major" }],
        summary: "a very useful summary",
      },
      cwd,
    );

    await version({ cwd, snapshot: true });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
        [
          {
            "dependencies": {
              "pkg-b": "0.0.0-20211213000730",
            },
            "name": "pkg-a",
            "version": "1.0.0",
          },
          {
            "name": "pkg-b",
            "version": "0.0.0-20211213000730",
          },
        ]
      `);
  });

  describe("snapshotPrereleaseTemplate", () => {
    it('should throw an error when "{tag}" and empty snapshot is used', async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          ...modifiedDefaultConfig,
          commit: false,
          snapshot: {
            ...modifiedDefaultConfig.snapshot,
            prereleaseTemplate: `{tag}.{commit}`,
          },
        }),
      });
      await writeChangesets(
        [
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );

      await expect(version({ cwd, snapshot: true })).rejects.toThrow(
        'Failed to compose snapshot version: "{tag}" placeholder is used without having a value defined!',
      );
    });

    it('should throw an error when "{tag}" is set and named snapshot is used', async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          ...modifiedDefaultConfig,
          commit: false,
          snapshot: {
            ...modifiedDefaultConfig.snapshot,
            prereleaseTemplate: `{commit}`,
          },
        }),
      });
      await writeChangesets(
        [
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );

      await expect(version({ cwd, snapshot: "test" })).rejects.toThrow(
        "Failed to compose snapshot version: \"{tag}\" placeholder is missing, but the snapshot parameter is defined (value: 'test')",
      );
    });

    it.each<[string | null | undefined, string | true, string]>([
      // Template-based
      ["{tag}", "test", "0.0.0-test"],
      ["{tag}-{tag}", "test", "0.0.0-test-test"],
      ["{commit}", true, "0.0.0-abcdefghijklmnopqrstuvwxyz"],
      ["{commit-short}", true, "0.0.0-abcdefg"],
      ["{timestamp}", true, "0.0.0-1639354050879"],
      ["{datetime}", true, "0.0.0-20211213000730"],
      // Mixing template and static string
      [
        "{tag}.{timestamp}.{commit}",
        "alpha",
        "0.0.0-alpha.1639354050879.abcdefghijklmnopqrstuvwxyz",
      ],
      ["{tag}.{commit-short}", "alpha", "0.0.0-alpha.abcdefg"],
      ["{datetime}-{tag}", "alpha", "0.0.0-20211213000730-alpha"],
    ])(
      "should customize release correctly based on snapshotPrereleaseTemplate template: %s (tag: '%s')",
      async (snapshotTemplate, snapshotValue, expectedResult) => {
        vi.setSystemTime("2021-12-13T00:07:30.879Z");

        const cwd = await testdir({
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "yarn.lock": "",
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
            ...modifiedDefaultConfig,
            commit: false,
            snapshot: {
              ...modifiedDefaultConfig.snapshot,
              prereleaseTemplate: snapshotTemplate as string,
            },
          }),
        });
        await writeChangesets(
          [
            {
              summary: "This is a summary too",
              releases: [
                { name: "pkg-a", type: "minor" },
                { name: "pkg-b", type: "patch" },
              ],
            },
          ],
          cwd,
        );
        await version({ cwd, snapshot: snapshotValue });

        expect(await getPkgJSON("pkg-a", cwd)).toEqual(
          expect.objectContaining({
            name: "pkg-a",
            version: expectedResult,
          }),
        );

        expect(await getPkgJSON("pkg-b", cwd)).toEqual(
          expect.objectContaining({
            name: "pkg-b",
            version: expectedResult,
          }),
        );
      },
    );
  });

  describe("snapshot.useCalculatedVersion: true", () => {
    it("should update packages using calculated version", async () => {
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          ...modifiedDefaultConfig,
          commit: false,
          snapshot: {
            useCalculatedVersion: true,
            prereleaseTemplate: undefined,
          },
        }),
      });
      await writeChangesets(
        [
          {
            summary: "This is a summary too",
            releases: [
              { name: "pkg-a", type: "minor" },
              { name: "pkg-b", type: "patch" },
            ],
          },
        ],
        cwd,
      );
      await version({ cwd, snapshot: "experimental" });
      expect(await getPkgJSON("pkg-a", cwd)).toEqual(
        expect.objectContaining({
          name: "pkg-a",
          version: expect.stringContaining("1.1.0-experimental-"),
        }),
      );

      expect(await getPkgJSON("pkg-b", cwd)).toEqual(
        expect.objectContaining({
          name: "pkg-b",
          version: expect.stringContaining("1.0.1-experimental-"),
        }),
      );
    });

    it("should not bump version of a package with an explicit none release type", async () => {
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
        ".changeset/config.json": JSON.stringify({
          ...modifiedDefaultConfig,
          snapshot: {
            useCalculatedVersion: true,
            prereleaseTemplate: undefined,
          },
        }),
      });
      await writeChangeset(
        {
          releases: [{ name: "pkg-a", type: "none" }],
          summary: "some internal stuff",
        },
        cwd,
      );

      await version({ cwd, snapshot: true });

      expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
        .toMatchInlineSnapshot(`
        [
          {
            "name": "pkg-a",
            "version": "1.0.0",
          },
        ]
      `);
    });

    it("should not bump version of an ignored package when its dependency gets updated", async () => {
      vi.setSystemTime("2021-12-13T00:07:30.879Z");

      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "yarn.lock": "",
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
          ...modifiedDefaultConfig,
          ignore: ["pkg-a"],
          snapshot: {
            useCalculatedVersion: true,
            prereleaseTemplate: undefined,
          },
        }),
      });
      await writeChangeset(
        {
          releases: [{ name: "pkg-b", type: "major" }],
          summary: "a very useful summary",
        },
        cwd,
      );

      await version({ cwd, snapshot: true });

      expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
        .toMatchInlineSnapshot(`
          [
            {
              "dependencies": {
                "pkg-b": "2.0.0-20211213000730",
              },
              "name": "pkg-a",
              "version": "1.0.0",
            },
            {
              "name": "pkg-b",
              "version": "2.0.0-20211213000730",
            },
          ]
        `);
    });
  });
});

describe("updateInternalDependents: always", () => {
  it("should bump a direct dependent when a dependency package gets bumped", async () => {
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
        dependencies: {
          "pkg-b": "^1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
          updateInternalDependents: "always",
        },
      }),
    });
    await writeChangeset(
      {
        summary: "This is not a summary",
        releases: [{ name: "pkg-b", type: "patch" }],
      },
      cwd,
    );
    await version({ cwd });

    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-a",
        version: "1.0.1",
        dependencies: {
          "pkg-b": "^1.0.1",
        },
      }),
    );
    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-b",
        version: "1.0.1",
      }),
    );
    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.0.1

      ### Patch Changes

      - Updated dependencies [g1th4sh]
        - pkg-b@1.0.1
      "
    `);
    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.0.1

      ### Patch Changes

      - g1th4sh: This is not a summary
      "
    `);
  });

  it("should not bump a dev dependent nor its dependent when a package gets bumped", async () => {
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
        devDependencies: { "pkg-a": "1.0.0" },
      }),
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "1.0.0",
        dependencies: { "pkg-b": "1.0.0" },
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
          updateInternalDependents: "always",
        },
      }),
    });

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await version({ cwd });

    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-a",
        version: "1.1.0",
      }),
    );
    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-b",
        version: "1.0.0",
        devDependencies: {
          "pkg-a": "1.1.0",
        },
      }),
    );
    // `pkg-c` should not be touched
    expect(await getPkgJSON("pkg-c", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-c",
        version: "1.0.0",
        dependencies: { "pkg-b": "1.0.0" },
      }),
    );

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary
      "
    `);

    // pkg-b and - pkg-c are not being released so changelogs should not be
    // generated for them
    await expect(
      fs.access(await getFilePath("pkg-b", "CHANGELOG.md", cwd)),
    ).rejects.toThrow();
    await expect(
      fs.access(await getFilePath("pkg-c", "CHANGELOG.md", cwd)),
    ).rejects.toThrow();
  });

  it("should not bump dependant when it depends on an npm tag of a bumped dependency", async () => {
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
        dependencies: { "pkg-a": "bulbasaur" }, // using tag version from npm
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
          updateInternalDependents: "always",
        },
      }),
    });

    await writeChangeset(
      {
        summary: "This is some fix",
        releases: [{ name: "pkg-b", type: "patch" }],
      },
      cwd,
    );
    await version({ cwd });

    // `pkg-a` should not be touched
    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-a",
        version: "1.0.0",
      }),
    );

    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-b",
        version: "1.0.1",
        dependencies: { "pkg-a": "bulbasaur" },
      }),
    );

    // shouldn't be created
    await expect(
      fs.access(await getFilePath("pkg-a", "CHANGELOG.md", cwd)),
    ).rejects.toThrow();

    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.0.1

      ### Patch Changes

      - g1th4sh: This is some fix
      "
    `);
  });

  it("should bump dependant when it depend on an npm tag of a bumped dependency when it has its own changeset", async () => {
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
        dependencies: { "pkg-a": "bulbasaur" }, // using tag version from npm
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
          updateInternalDependents: "always",
        },
      }),
    });

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await writeChangeset(
      {
        summary: "This is some fix",
        releases: [{ name: "pkg-b", type: "patch" }],
      },
      cwd,
    );
    await version({ cwd });

    expect(await getPkgJSON("pkg-a", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-a",
        version: "1.1.0",
      }),
    );
    expect(await getPkgJSON("pkg-b", cwd)).toEqual(
      expect.objectContaining({
        name: "pkg-b",
        version: "1.0.1",
        dependencies: { "pkg-a": "bulbasaur" },
      }),
    );

    expect(await getChangelog("pkg-a", cwd)).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: This is a summary
      "
    `);

    expect(await getChangelog("pkg-b", cwd)).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.0.1

      ### Patch Changes

      - g1th4sh: This is some fix
      "
    `);
  });
});

describe("pre", () => {
  it("should work", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await pre({ cwd, command: "enter", tag: "next" });
    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });
    let packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "1.0.1-next.0",
        },
        name: "pkg-a",
        version: "1.0.1-next.0",
      },
      {
        name: "pkg-b",
        version: "1.0.1-next.0",
      },
    ]);
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "patch" }],
        summary: "a very useful summary",
      },
      cwd,
    );

    await version({ cwd });
    packages = (await getPackages(cwd))!;
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "1.0.1-next.0",
        },
        name: "pkg-a",
        version: "1.0.1-next.1",
      },
      {
        name: "pkg-b",
        version: "1.0.1-next.0",
      },
    ]);
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "patch" }],
        summary: "a very useful summary for the second change",
      },
      cwd,
    );
    await version({ cwd });
    packages = (await getPackages(cwd))!;
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "1.0.1-next.0",
        },
        name: "pkg-a",
        version: "1.0.1-next.2",
      },
      {
        name: "pkg-b",
        version: "1.0.1-next.0",
      },
    ]);
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "minor" }],
        summary: "a very useful summary for the third change",
      },
      cwd,
    );
    await version({ cwd });
    packages = (await getPackages(cwd))!;
    expect(packages.packages.map((x) => x.packageJson)).toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "1.0.1-next.0",
          },
          "name": "pkg-a",
          "version": "1.1.0-next.3",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1-next.0",
        },
      ]
    `);
    await pre({ cwd, command: "exit" });
    await version({ cwd });
    packages = (await getPackages(cwd))!;
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "1.0.1",
        },
        name: "pkg-a",
        version: "1.1.0",
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
    expect(
      await fs.readFile(
        path.join(packages.packages[0].dir, "CHANGELOG.md"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0

      ### Minor Changes

      - g1th4sh: a very useful summary for the third change

      ### Patch Changes

      - g1th4sh: a very useful summary
      - g1th4sh: a very useful summary for the second change
      - Updated dependencies [g1th4sh]
        - pkg-b@1.0.1

      ## 1.1.0-next.3

      ### Minor Changes

      - g1th4sh: a very useful summary for the third change

      ## 1.0.1-next.2

      ### Patch Changes

      - g1th4sh: a very useful summary for the second change

      ## 1.0.1-next.1

      ### Patch Changes

      - g1th4sh: a very useful summary

      ## 1.0.1-next.0

      ### Patch Changes

      - Updated dependencies [g1th4sh]
        - pkg-b@1.0.1-next.0
      "
    `);
    expect(
      await fs.readFile(
        path.join(packages.packages[1].dir, "CHANGELOG.md"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.0.1

      ### Patch Changes

      - g1th4sh: a very useful summary for the first change

      ## 1.0.1-next.0

      ### Patch Changes

      - g1th4sh: a very useful summary for the first change
      "
    `);
  });
  it("should work with adding a package while in pre mode", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await pre({ cwd, command: "enter", tag: "next" });
    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await version({ cwd });
    let packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "1.0.1-next.0",
        },
        name: "pkg-a",
        version: "1.0.1-next.0",
      },
      {
        name: "pkg-b",
        version: "1.0.1-next.0",
      },
    ]);
    await fs.mkdir(path.join(cwd, "packages", "pkg-c"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "packages", "pkg-c", "package.json"),
      JSON.stringify(
        {
          name: "pkg-c",
          version: "0.0.0",
        },
        null,
        2,
      ) + "\n",
    );
    await writeChangeset(
      {
        releases: [
          { name: "pkg-b", type: "major" },
          { name: "pkg-c", type: "patch" },
        ],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });
    packages = (await getPackages(cwd))!;

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "2.0.0-next.1",
        },
        name: "pkg-a",
        version: "1.0.1-next.1",
      },
      {
        name: "pkg-b",
        version: "2.0.0-next.1",
      },
      {
        name: "pkg-c",
        version: "0.0.1-next.0",
      },
    ]);
  });
  it("should work for my weird case", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "minor" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });
    let packages = await getPackages(cwd);

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: { "pkg-b": "1.0.0" },
        name: "pkg-a",
        version: "1.1.0",
      },
      {
        name: "pkg-b",
        version: "1.0.0",
      },
    ]);

    await pre({ cwd, command: "enter", tag: "next" });
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "patch" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });
    packages = (await getPackages(cwd))!;

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: { "pkg-b": "1.0.0" },
        name: "pkg-a",
        version: "1.1.1-next.0",
      },
      {
        name: "pkg-b",
        version: "1.0.0",
      },
    ]);
  });
  // https://github.com/changesets/changesets/pull/382#discussion_r434434182
  it("should bump patch version for packages that had prereleases, but caret dependencies are still in range", async () => {
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
        dependencies: {
          "pkg-b": "^1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await pre({ cwd, command: "enter", tag: "next" });
    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });

    let packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "^1.0.1-next.0",
        },
        name: "pkg-a",
        version: "1.0.1-next.0",
      },
      {
        name: "pkg-b",
        version: "1.0.1-next.0",
      },
    ]);

    await pre({ cwd, command: "exit" });
    await version({ cwd });

    packages = (await getPackages(cwd))!;
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: {
          "pkg-b": "^1.0.1",
        },
        name: "pkg-a",
        version: "1.0.1",
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
  });

  it("should use the highest bump type between all prereleases when versioning a package", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "major" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await pre({ cwd, command: "enter", tag: "next" });
    await version({ cwd });
    let packages = await getPackages(cwd);

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: { "pkg-b": "1.0.0" },
        name: "pkg-a",
        version: "2.0.0-next.0",
      },
      {
        name: "pkg-b",
        version: "1.0.0",
      },
    ]);

    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "minor" }],
        summary: "a very useful summary for the second change",
      },
      cwd,
    );
    await version({ cwd });
    packages = (await getPackages(cwd))!;

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: { "pkg-b": "1.0.0" },
        name: "pkg-a",
        version: "2.0.0-next.1",
      },
      {
        name: "pkg-b",
        version: "1.0.0",
      },
    ]);
  });
  it("should use the highest bump type between all prereleases when versioning a dependent package", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await pre({ cwd, command: "enter", tag: "next" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "major" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await version({ cwd });
    let packages = await getPackages(cwd);

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: { "pkg-b": "1.0.0" },
        name: "pkg-a",
        version: "2.0.0-next.0",
      },
      {
        name: "pkg-b",
        version: "1.0.0",
      },
    ]);

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "minor" }],
        summary: "a very useful summary for the second change",
      },
      cwd,
    );
    await version({ cwd });
    packages = (await getPackages(cwd))!;

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "2.0.0-next.1",
        dependencies: { "pkg-b": "1.1.0-next.0" },
      },
      {
        name: "pkg-b",
        version: "1.1.0-next.0",
      },
    ]);
  });

  it("should not bump packages through devDependencies", async () => {
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
        devDependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "major" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await pre({ cwd, command: "enter", tag: "next" });
    await version({ cwd });
    const packages = await getPackages(cwd);

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        devDependencies: { "pkg-b": "2.0.0-next.0" },
        name: "pkg-a",
        version: "1.0.0",
      },
      {
        name: "pkg-b",
        version: "2.0.0-next.0",
      },
    ]);
  });
  it("should not bump ignored packages through dependencies", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        ignore: ["pkg-a"],
      }),
    });
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "major" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "major" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );

    await pre({ cwd, command: "enter", tag: "next" });
    await version({ cwd });
    const packages = await getPackages(cwd);

    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        dependencies: { "pkg-b": "2.0.0-next.0" },
        name: "pkg-a",
        version: "1.0.0",
      },
      {
        name: "pkg-b",
        version: "2.0.0-next.0",
      },
    ]);
  });
  it("should bump dependent of prerelease package when bumping a `workspace:~` dependency", async () => {
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
        dependencies: {
          "pkg-b": "workspace:~",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await pre({ cwd, command: "enter", tag: "alpha" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );
    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.0.1-alpha.0",
        dependencies: {
          "pkg-b": "workspace:~",
        },
      },
      {
        name: "pkg-b",
        version: "1.0.1-alpha.0",
      },
    ]);
  });

  it("should replace star range for dependency in dependant package when that dependency has its first prerelease in an already active pre mode", async () => {
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
        dependencies: {
          "pkg-b": "*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await pre({ cwd, command: "enter", tag: "alpha" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "*",
          },
          "name": "pkg-a",
          "version": "1.0.1-alpha.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.0",
        },
      ]
    `);

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "1.0.1-alpha.0",
          },
          "name": "pkg-a",
          "version": "1.0.1-alpha.1",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1-alpha.0",
        },
      ]
    `);
  });

  it("bumping dependency in pre mode should result in dependant with star range on that dependency to be patch bumped and that range to be replaced with exact version", async () => {
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
        dependencies: {
          "pkg-b": "*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await pre({ cwd, command: "enter", tag: "alpha" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "1.0.1-alpha.0",
          },
          "name": "pkg-a",
          "version": "1.0.1-alpha.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1-alpha.0",
        },
      ]
    `);
  });

  it("bumping dependency in pre mode should result in dependant with workspace:* range on that dependency to be patch bumped without changing the dependency range", async () => {
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
        dependencies: {
          "pkg-b": "workspace:*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await pre({ cwd, command: "enter", tag: "alpha" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "workspace:*",
          },
          "name": "pkg-a",
          "version": "1.0.1-alpha.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1-alpha.0",
        },
      ]
    `);
  });

  it("bumping dependency in pre mode should result in dependant with workspace:^ range on that dependency to be patch bumped without changing the dependency range", async () => {
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
        dependencies: {
          "pkg-b": "workspace:^",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await pre({ cwd, command: "enter", tag: "alpha" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "workspace:^",
          },
          "name": "pkg-a",
          "version": "1.0.1-alpha.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1-alpha.0",
        },
      ]
    `);
  });

  it("bumping dependency in pre mode should result in dependant with workspace:~ range on that dependency to be patch bumped without changing the dependency range", async () => {
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
        dependencies: {
          "pkg-b": "workspace:~",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });

    await pre({ cwd, command: "enter", tag: "alpha" });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the change",
      },
      cwd,
    );

    await version({ cwd });

    expect((await getPackages(cwd)).packages.map((x) => x.packageJson))
      .toMatchInlineSnapshot(`
      [
        {
          "dependencies": {
            "pkg-b": "workspace:~",
          },
          "name": "pkg-a",
          "version": "1.0.1-alpha.0",
        },
        {
          "name": "pkg-b",
          "version": "1.0.1-alpha.0",
        },
      ]
    `);
  });

  it("should version successfully when skipping a private package without a version field", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        private: true,
        // no version
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify(modifiedDefaultConfig),
    });
    await pre({ cwd, command: "enter", tag: "next" });
    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });
    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        private: true,
      },
      {
        name: "pkg-b",
        version: "1.0.1-next.0",
      },
    ]);
  });

  it("should version successfully a private package when tagging for them is disabled", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        private: true,
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        privatePackages: {
          tag: false,
          version: true,
        },
      }),
    });
    await pre({ cwd, command: "enter", tag: "next" });
    await writeChangeset(
      {
        releases: [{ name: "pkg-a", type: "patch" }],
        summary: "a very useful summary for the first change",
      },
      cwd,
    );
    await version({ cwd });
    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        private: true,
        version: "1.0.1-next.0",
      },
    ]);
  });

  describe("linked", () => {
    it("should work with linked", async () => {
      const linkedConfig = {
        ...modifiedDefaultConfig,
        linked: [["pkg-a", "pkg-b"]],
      };
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
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(linkedConfig),
      });
      await writeChangeset(
        {
          releases: [{ name: "pkg-a", type: "minor" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      let packages = await getPackages(cwd);

      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          dependencies: { "pkg-b": "1.0.0" },
          name: "pkg-a",
          version: "1.1.0",
        },
        {
          name: "pkg-b",
          version: "1.0.0",
        },
      ]);

      await pre({ cwd, command: "enter", tag: "next" });
      await writeChangeset(
        {
          releases: [{ name: "pkg-b", type: "patch" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      packages = (await getPackages(cwd))!;

      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          dependencies: { "pkg-b": "1.1.1-next.0" },
          name: "pkg-a",
          version: "1.1.1-next.0",
        },
        {
          name: "pkg-b",
          version: "1.1.1-next.0",
        },
      ]);
      await writeChangeset(
        {
          releases: [{ name: "pkg-a", type: "patch" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      packages = (await getPackages(cwd))!;
      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          dependencies: { "pkg-b": "1.1.1-next.0" },
          name: "pkg-a",
          version: "1.1.1-next.1",
        },
        {
          name: "pkg-b",
          version: "1.1.1-next.0",
        },
      ]);
      await writeChangeset(
        {
          releases: [{ name: "pkg-a", type: "patch" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      packages = (await getPackages(cwd))!;
      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          dependencies: { "pkg-b": "1.1.1-next.0" },
          name: "pkg-a",
          version: "1.1.1-next.2",
        },
        {
          name: "pkg-b",
          version: "1.1.1-next.0",
        },
      ]);
    });

    it("should use the highest bump type between all prereleases for a linked package when versioning a dependent package", async () => {
      const linkedConfig = {
        ...modifiedDefaultConfig,
        linked: [["pkg-a", "pkg-b"]],
      };
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
          dependencies: {
            "pkg-c": "0.1.0",
          },
        }),
        "packages/pkg-c/package.json": JSON.stringify({
          name: "pkg-c",
          version: "0.1.0",
        }),
        ".changeset/config.json": JSON.stringify(linkedConfig),
      });
      await pre({ cwd, command: "enter", tag: "next" });
      await writeChangeset(
        {
          releases: [{ name: "pkg-a", type: "minor" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      let packages = await getPackages(cwd);

      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          name: "pkg-a",
          version: "1.1.0-next.0",
        },
        {
          name: "pkg-b",
          version: "1.0.0",
          dependencies: { "pkg-c": "0.1.0" },
        },
        {
          name: "pkg-c",
          version: "0.1.0",
        },
      ]);

      await writeChangeset(
        {
          releases: [{ name: "pkg-c", type: "patch" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      packages = (await getPackages(cwd))!;

      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          name: "pkg-a",
          version: "1.1.0-next.0",
        },
        {
          name: "pkg-b",
          version: "1.1.0-next.1",
          dependencies: { "pkg-c": "0.1.1-next.0" },
        },
        {
          name: "pkg-c",
          version: "0.1.1-next.0",
        },
      ]);
    });
    it("should not bump a linked package if its linked devDep gets released", async () => {
      const linkedConfig = {
        ...modifiedDefaultConfig,
        linked: [["pkg-a", "pkg-b"]],
      };
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          devDependencies: {
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(linkedConfig),
      });
      await writeChangeset(
        {
          releases: [{ name: "pkg-b", type: "patch" }],
          summary: "a very useful summary",
        },
        cwd,
      );
      await version({ cwd });
      const packages = await getPackages(cwd);

      expect(packages.packages.map((x) => x.packageJson)).toEqual([
        {
          name: "pkg-a",
          version: "1.0.0",
          devDependencies: { "pkg-b": "1.0.1" },
        },
        {
          name: "pkg-b",
          version: "1.0.1",
        },
      ]);
    });
  });
});

describe("with privatePackages", () => {
  it("should skip private packages", async () => {
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
        private: true,
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/changesets-are-beautiful.md": `---
"pkg-b": minor
---

Nice simple summary, much wow
`,
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        privatePackages: {
          version: false,
          tag: false,
        },
      }),
    });

    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        version: "1.0.0",
        private: true,
        dependencies: {
          "pkg-b": "1.1.0",
        },
      },
      {
        name: "pkg-b",
        version: "1.1.0",
      },
    ]);
  });

  it("should update dependencies in a private package without a version field", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        private: true,
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        ...modifiedDefaultConfig,
        privatePackages: {
          version: false,
          tag: false,
        },
      }),
    });

    await writeChangeset(
      {
        releases: [{ name: "pkg-b", type: "patch" }],
        summary: "a very useful summary",
      },
      cwd,
    );
    await version({ cwd });

    const packages = await getPackages(cwd);
    expect(packages.packages.map((x) => x.packageJson)).toEqual([
      {
        name: "pkg-a",
        private: true,
        dependencies: {
          "pkg-b": "1.0.1",
        },
      },
      {
        name: "pkg-b",
        version: "1.0.1",
      },
    ]);
  });

  it("should not throw if dependents of unversioned private packages are not explicitly listed by the ignore flag", async () => {
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
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({
        privatePackages: {
          tag: false,
          version: false,
        },
      }),
    });
    try {
      await version({ cwd, ignore: ["pkg-b"] });
    } catch {
      // ignore the error. We just want to validate the error message
    }

    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("should not throw on a dev dependent on an unversioned private package", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        devDependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
        private: true,
      }),
      ".changeset/config.json": JSON.stringify({
        privatePackages: {
          tag: false,
          version: false,
        },
      }),
    });
    try {
      await version({ cwd });
    } catch {
      // ignore the error. We just want to validate the error message
    }

    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("should not throw if a versioned private package depends on an ignored package", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        private: true,
        dependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
        private: true,
      }),
      ".changeset/changesets-are-beautiful.md": `---
"pkg-a": minor
---

Nice simple summary, much wow
`,
      ".changeset/config.json": JSON.stringify({}),
    });

    await version({ cwd, ignore: ["pkg-b"] });

    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("should not throw if a package only has a devDependency on an ignored package", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        devDependencies: {
          "pkg-b": "1.0.0",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      ".changeset/changesets-are-beautiful.md": `---
"pkg-a": minor
---

Nice simple summary, much wow
`,
      ".changeset/config.json": JSON.stringify({}),
    });

    await version({ cwd, ignore: ["pkg-b"] });

    expect(mockedLogger.error).not.toHaveBeenCalled();
  });
});
