import { vi } from "vitest";
import {
  silenceLogsInBlock,
  mockedLogger,
  testdir,
} from "@changesets/test-utils";

import { run } from "./run.ts";
import writeChangeset from "@changesets/write";

vi.mock("./commands/version");

silenceLogsInBlock();

describe("cli", () => {
  describe("version", () => {
    it("should validate package name passed in from --ignore flag", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({}),
      });
      try {
        await run(["version"], { ignore: "pkg-c" }, cwd);
      } catch (e) {
        // ignore errors. We just want to validate the error message
      }

      const loggerErrorCalls = mockedLogger.error!.mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toEqual(
        `The package "pkg-c" is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`,
      );
    });

    it("should throw if dependents of ignored packages are not explicitly listed in the ignore array", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
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
        ".changeset/config.json": JSON.stringify({}),
      });
      try {
        await run(["version"], { ignore: ["pkg-b"] }, cwd);
      } catch (e) {
        // ignore the error. We just want to validate the error message
      }

      const loggerErrorCalls = mockedLogger.error!.mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toMatchInlineSnapshot(
        `"The package "pkg-a" depends on the skipped package "pkg-b" (either by \`ignore\` option or by \`privatePackages.version\`), but "pkg-a" is not being skipped. Please pass "pkg-a" to the \`--ignore\` flag."`,
      );
    });

    it("should not throw if dependents of unversioned private packages are not explicitly listed by the ignore flag", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
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
      } catch (e) {
        // ignore the error. We just want to validate the error message
      }

      const loggerErrorCalls = mockedLogger.error!.mock.calls;
      expect(loggerErrorCalls.length).toEqual(0);
    });

    it("should not throw on a dev dependent on an unversioned private package", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
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
      } catch (e) {
        // ignore the error. We just want to validate the error message
      }

      const loggerErrorCalls = mockedLogger.error!.mock.calls;
      expect(loggerErrorCalls.length).toEqual(0);
    });

    it("should throw if `--ignore` flag is used while ignore array is also defined in the config file ", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
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
          ignore: ["pkg-a"],
        }),
      });
      try {
        await run(["version"], { ignore: "pkg-b" }, cwd);
      } catch (e) {
        // ignore errors. We just want to validate the error message
      }

      const loggerErrorCalls = mockedLogger.error!.mock.calls;
      expect(loggerErrorCalls.length).toEqual(1);
      expect(loggerErrorCalls[0][0]).toEqual(
        `It looks like you are trying to use the \`--ignore\` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.`,
      );
    });

    it("should not throw if `prettier: false` is configured", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          prettier: false,
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

    it('should throw if `prettier: "string"` is configured', async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify({
          prettier: "no thanks",
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
        The \`prettier\` option is set as "no thanks" when the only valid values are undefined or a boolean]
      `);
    });
  });
});
