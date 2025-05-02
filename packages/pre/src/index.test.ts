import { enterPre, exitPre, readPreState } from "./index.ts";
import fs from "node:fs/promises";
import path from "path";
import {
  PreEnterButInPreModeError,
  PreExitButNotInPreModeError,
} from "@changesets/errors";
import { testdir } from "@changesets/test-utils";

describe("enterPre", () => {
  it("should enter", async () => {
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
    });
    await enterPre(cwd, "next");

    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset", "pre.json"), "utf8")
      )
    ).toMatchInlineSnapshot(`
      {
        "changesets": [],
        "initialVersions": {
          "pkg-a": "1.0.0",
          "pkg-b": "1.0.0",
        },
        "mode": "pre",
        "tag": "next",
      }
    `);
  });
  it("should throw if already in pre", async () => {
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
      ".changeset/pre.json": JSON.stringify({
        changesets: [],
        initialVersions: {
          "pkg-a": "1.0.0",
          "pkg-b": "1.0.0",
        },
        mode: "pre",
        tag: "next",
      }),
    });
    await expect(enterPre(cwd, "some-tag")).rejects.toBeInstanceOf(
      PreEnterButInPreModeError
    );
  });
  it("should enter if already exited pre mode", async () => {
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
      ".changeset/pre.json": JSON.stringify({
        changesets: ["slimy-dingos-whisper"],
        initialVersions: {
          "pkg-a": "1.0.0",
          "pkg-b": "1.0.0",
        },
        mode: "exit",
        tag: "beta",
      }),
    });
    await enterPre(cwd, "next");
    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset", "pre.json"), "utf8")
      )
    ).toMatchInlineSnapshot(`
      {
        "changesets": [
          "slimy-dingos-whisper",
        ],
        "initialVersions": {
          "pkg-a": "1.0.0",
          "pkg-b": "1.0.0",
        },
        "mode": "pre",
        "tag": "next",
      }
    `);
  });
});

describe("exitPre", () => {
  it("should exit", async () => {
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
      ".changeset/pre.json": JSON.stringify({
        changesets: [],
        initialVersions: {
          "pkg-a": "1.0.0",
          "pkg-b": "1.0.0",
        },
        mode: "pre",
        tag: "next",
      }),
    });
    await exitPre(cwd);

    expect(
      JSON.parse(
        await fs.readFile(path.join(cwd, ".changeset", "pre.json"), "utf8")
      )
    ).toMatchInlineSnapshot(`
      {
        "changesets": [],
        "initialVersions": {
          "pkg-a": "1.0.0",
          "pkg-b": "1.0.0",
        },
        "mode": "exit",
        "tag": "next",
      }
    `);
  });
  it("should throw if not in pre", async () => {
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
      ".changeset/config.json": JSON.stringify({}),
    });
    await expect(exitPre(cwd)).rejects.toBeInstanceOf(
      PreExitButNotInPreModeError
    );
  });
});

test("readPreState reads the pre state", async () => {
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
    ".changeset/pre.json": JSON.stringify({
      changesets: [],
      initialVersions: {
        "pkg-a": "1.0.0",
        "pkg-b": "1.0.0",
      },
      mode: "pre",
      tag: "next",
    }),
  });
  expect(await readPreState(cwd)).toMatchInlineSnapshot(`
    {
      "changesets": [],
      "initialVersions": {
        "pkg-a": "1.0.0",
        "pkg-b": "1.0.0",
      },
      "mode": "pre",
      "tag": "next",
    }
  `);
});
