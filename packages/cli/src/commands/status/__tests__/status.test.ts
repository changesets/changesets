import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { gitdir, outputFile, silenceLogsInBlock } from "@changesets/test-utils";
import type { ReleasePlan } from "@changesets/types";
import { writeChangeset } from "@changesets/write";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { status } from "../index.ts";

function replaceHumanIds(releaseObj: ReleasePlan | undefined) {
  if (!releaseObj) {
    return;
  }
  let counter = 0;
  const changesetNames = new Map<string, string>();

  return {
    ...releaseObj,
    changesets: releaseObj.changesets.map((changeset) => {
      if (changesetNames.get(changeset.id)) {
        throw new Error("Duplicate changeset id found: " + changeset.id);
      }
      const replacedId = `~changeset-${++counter}~`;
      changesetNames.set(changeset.id, replacedId);
      return {
        ...changeset,
        id: replacedId,
      };
    }),
    releases: releaseObj.releases.map((release) => ({
      ...release,
      changesets: release.changesets.map((id) => changesetNames.get(id) || id),
    })),
  };
}

describe("status", { tags: ["slow"] }, () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should get the status for a simple changeset and return the release object", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "updated a"',
    );
    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    const releaseObj = await status({ cwd, since: "main" });
    expect(replaceHumanIds(releaseObj)).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "~changeset-1~",
            "releases": [
              {
                "name": "pkg-a",
                "type": "minor",
              },
            ],
            "summary": "This is a summary",
          },
        ],
        "preState": undefined,
        "releases": [
          {
            "changesets": [
              "~changeset-1~",
            ],
            "name": "pkg-a",
            "newVersion": "1.1.0",
            "oldVersion": "1.0.0",
            "type": "minor",
          },
        ],
      }
    `);
  });

  it("should get the status comparing to the base branch with undefined since", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({
        baseBranch: "main",
      }),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "updated a"',
    );
    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    const releaseObj = await status({ cwd });
    expect(replaceHumanIds(releaseObj)).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "~changeset-1~",
            "releases": [
              {
                "name": "pkg-a",
                "type": "minor",
              },
            ],
            "summary": "This is a summary",
          },
        ],
        "preState": undefined,
        "releases": [
          {
            "changesets": [
              "~changeset-1~",
            ],
            "name": "pkg-a",
            "newVersion": "1.1.0",
            "oldVersion": "1.0.0",
            "type": "minor",
          },
        ],
      }
    `);
  });

  it("should read current versions from configured version providers", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/demo-ruby-gem/package.json": JSON.stringify({
        name: "demo-ruby-gem",
        version: "0.1.0",
        private: true,
      }),
      "packages/demo-ruby-gem/lib/demo_ruby_gem/version.rb": `module DemoRubyGem
  VERSION = "0.2.0"
end
`,
      ".changeset/config.json": JSON.stringify({
        versionProvider: {
          default: "node",
          packages: {
            "demo-ruby-gem": "ruby",
          },
        },
      }),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/demo-ruby-gem/lib/demo_ruby_gem.rb"),
      'require_relative "demo_ruby_gem/version"',
    );
    await writeChangeset(
      {
        summary: "This is a Ruby summary",
        releases: [{ name: "demo-ruby-gem", type: "patch" }],
      },
      cwd,
    );
    await git.add(".", cwd);
    await git.commit("updated ruby gem", cwd);

    const releaseObj = await status({ cwd, since: "main" });
    expect(replaceHumanIds(releaseObj)).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "~changeset-1~",
            "releases": [
              {
                "name": "demo-ruby-gem",
                "type": "patch",
              },
            ],
            "summary": "This is a Ruby summary",
          },
        ],
        "preState": undefined,
        "releases": [
          {
            "changesets": [
              "~changeset-1~",
            ],
            "name": "demo-ruby-gem",
            "newVersion": "0.2.1",
            "oldVersion": "0.2.0",
            "type": "patch",
          },
        ],
      }
    `);
  });

  it("should exit early with a non-zero error code when there are changed packages but no changesets", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "updated a"',
    );

    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    const promise = status({ cwd, since: "main" });
    await expect(promise).rejects.toThrow();
  });

  it("should not exit early with a non-zero error code when there are no changed packages", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    const releaseObj = await status({ cwd, since: "main" });

    expect(process.exit).not.toHaveBeenCalled();
    expect(releaseObj).toEqual({
      changesets: [],
      releases: [],
      preState: undefined,
    });
  });

  it("should not exit early with a non-zero code when there are changed packages and also a changeset", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "updated a"',
    );
    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );

    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    await status({ cwd, since: "main" });

    expect(process.exit).not.toHaveBeenCalled();
  });

  it.todo("should respect the verbose flag", () => false);

  it("should respect the output flag", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "updated a"',
    );

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );

    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    const output = "nonsense.json";

    const probsUndefined = await status({ cwd, since: "main", output });

    const releaseObj = await fs.readFile(path.join(cwd, output), "utf8");

    expect(probsUndefined).toEqual(undefined);
    expect(replaceHumanIds(JSON.parse(releaseObj))).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "~changeset-1~",
            "releases": [
              {
                "name": "pkg-a",
                "type": "minor",
              },
            ],
            "summary": "This is a summary",
          },
        ],
        "releases": [
          {
            "changesets": [
              "~changeset-1~",
            ],
            "name": "pkg-a",
            "newVersion": "1.1.0",
            "oldVersion": "1.0.0",
            "type": "minor",
          },
        ],
      }
    `);
  });

  it("should not exit early with a non-zero error code when there are no changed packages matching the pattern", async () => {
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
      }),
      ".changeset/config.json": JSON.stringify({
        changedFilePatterns: ["src/**"],
      }),
    });

    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/unrelated.json"),
      JSON.stringify({}),
    );

    await git.add(".", cwd);
    await git.commit("add unrelated thing", cwd);

    const releaseObj = await status({ cwd, since: "main" });

    expect(process.exit).not.toHaveBeenCalled();
    expect(releaseObj).toEqual({
      changesets: [],
      releases: [],
      preState: undefined,
    });
  });

  it("should exit early with a non-zero error code when there are changed packages matching the pattern but no changesets", async () => {
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
      }),
      "packages/pkg-a/src/a.js": 'export default "a"',
      ".changeset/config.json": JSON.stringify({
        changedFilePatterns: ["src/**"],
      }),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/src/a.js"),
      'export default "updated a"',
    );

    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    const promise = status({ cwd, since: "main" });
    await expect(promise).rejects.toThrow();
  });

  it("should not exit early with a non-zero error code when there are changed packages matching the pattern and appropriate changeset", async () => {
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
      }),
      "packages/pkg-a/src/a.js": 'export default "a"',
      ".changeset/config.json": JSON.stringify({
        changedFilePatterns: ["src/**"],
      }),
    });

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-a/a.js"),
      'export default "updated a"',
    );
    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );
    await git.add(".", cwd);
    await git.commit("updated a", cwd);

    const releaseObj = await status({ cwd, since: "main" });
    expect(replaceHumanIds(releaseObj)).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "~changeset-1~",
            "releases": [
              {
                "name": "pkg-a",
                "type": "minor",
              },
            ],
            "summary": "This is a summary",
          },
        ],
        "preState": undefined,
        "releases": [
          {
            "changesets": [
              "~changeset-1~",
            ],
            "name": "pkg-a",
            "newVersion": "1.1.0",
            "oldVersion": "1.0.0",
            "type": "minor",
          },
        ],
      }
    `);
  });

  it("should not exit early with a non-zero error code when only changed packages are ignored", async () => {
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
      }),
      "packages/pkg-a/src/a.js": 'export default "a"',
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      "packages/pkg-b/src/b.js": 'export default "b"',
      ".changeset/config.json": JSON.stringify({
        ignore: ["pkg-b"],
      }),
    });

    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-b/b.js"),
      'export default "updated b"',
    );
    await git.add(".", cwd);
    await git.commit("updated b", cwd);

    const releaseObj = await status({ cwd, since: "main" });

    expect(process.exit).not.toHaveBeenCalled();
    expect(releaseObj).toEqual({
      changesets: [],
      releases: [],
      preState: undefined,
    });
  });

  it("should not exit early with a non-zero error code when only changed packages are private and versioning for private packages is turned off", async () => {
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
      }),
      "packages/pkg-a/src/a.js": 'export default "a"',
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        private: true,
        version: "1.0.0",
      }),
      "packages/pkg-b/src/b.js": 'export default "b"',
      ".changeset/config.json": JSON.stringify({
        privatePackages: {
          version: false,
        },
      }),
    });

    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await exec("git", ["checkout", "-b", "new-branch"], {
      nodeOptions: { cwd },
    });

    await outputFile(
      path.join(cwd, "packages/pkg-b/b.js"),
      'export default "updated b"',
    );
    await git.add(".", cwd);
    await git.commit("updated b", cwd);

    const releaseObj = await status({ cwd, since: "main" });

    expect(process.exit).not.toHaveBeenCalled();
    expect(releaseObj).toEqual({
      changesets: [],
      releases: [],
      preState: undefined,
    });
  });
});
