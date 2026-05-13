import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { writeChangeset } from "@changesets/write";
import { log } from "@clack/prompts";
import { describe, expect, it, vi } from "vitest";
import { add } from "./commands/add/index.ts";
import { run } from "./run.ts";

const mockedLogger = vi.mocked(log);
vi.mock("./commands/add");
vi.mock("./commands/version");

silenceLogsInBlock();

describe("cli", () => {
  describe("add", () => {
    it("should pass --message to add when using default command", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          name: "single-package",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      await run([], { message: "summary from message" }, cwd);

      expect(add).toHaveBeenCalledWith(
        cwd,
        {
          empty: undefined,
          open: undefined,
          message: "summary from message",
        },
        expect.any(Object),
      );
    });

    it("should pass --message to add command", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          name: "single-package",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });

      await run(["add"], { message: "summary from message" }, cwd);

      expect(add).toHaveBeenCalledWith(
        cwd,
        {
          empty: undefined,
          open: undefined,
          message: "summary from message",
        },
        expect.any(Object),
      );
    });
  });

  describe("version", () => {
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
        await run(["version"], { ignore: ["pkg-b"] }, cwd);
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
        await run(["version"], {}, cwd);
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
        ".changeset/config.json": JSON.stringify({}),
      });

      await run(["version"], { ignore: ["pkg-b"] }, cwd);

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
        ".changeset/config.json": JSON.stringify({}),
      });

      await run(["version"], { ignore: ["pkg-b"] }, cwd);

      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    it("should not throw if `format: false` is configured", async () => {
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
          format: false,
        }),
      });
      await writeChangeset(
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
        cwd,
      );

      await expect(run(["version"], {}, cwd)).resolves.not.toThrow();
    });

    it('should throw if `format: "invalid"` is configured', async () => {
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
          format: "no thanks",
        }),
      });
      await writeChangeset(
        {
          summary: "This is a summary",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
        cwd,
      );

      await expect(run(["version"], {}, cwd)).rejects
        .toThrowErrorMatchingInlineSnapshot(`
        [Error: Some errors occurred when validating the changesets config:
        The \`format\` option is set as "no thanks" when the only valid values are "auto", "prettier", "oxfmt", "dprint", "deno" or false]
      `);
    });
  });

  describe("pre", () => {
    it("should throw an error if tag not passed in", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "yarn.lock": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });
      try {
        await run(["pre", "enter"], {}, cwd);
      } catch {
        // ignore the error. We just want to validate the error message
      }

      const loggerErrorCalls = mockedLogger.error.mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toEqual(
        `A tag must be passed when using prerelease enter`,
      );
    });
  });

  it("should be able to add a changesed when called from subdirectory", async () => {
    const rootDir = await testdir({
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
      ".changeset/config.json": JSON.stringify({}),
    });

    const cwd = path.resolve(rootDir, "packages", "pkg-a");

    await run([], { message: "test" }, cwd);

    expect(add).toHaveBeenCalledWith(
      rootDir,
      {
        empty: undefined,
        open: undefined,
        message: "test",
      },
      expect.any(Object),
    );
  });

  it("should throw when .changeset folder is missing when called from subdirectory", async () => {
    const rootDir = await testdir({
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
    });

    const cwd = path.resolve(rootDir, "packages", "pkg-a");

    try {
      await run(["version"], {}, cwd);
    } catch {
      // ignore the error. We just want to validate the error message
    }

    const arg = mockedLogger.error.mock.calls[0][0];
    expect(stripVTControlCharacters(arg)).toEqual(
      expect.stringContaining("There is no .changeset folder."),
    );
  });
});
