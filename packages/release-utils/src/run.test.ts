import fs from "node:fs/promises";
import path from "node:path";
import { add, commit } from "@changesets/git";
import {
  gitdir,
  linkNodeModules,
  shallowClone,
  silenceLogsInBlock,
} from "@changesets/test-utils";
import type { Changeset } from "@changesets/types";
import { writeChangeset } from "@changesets/write";
import { exec } from "tinyexec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPublish, runVersion } from "./run.ts";

const writeChangesets = async (changesets: Changeset[], cwd: string) => {
  await Promise.all(
    changesets.map((changeset) => writeChangeset(changeset, cwd)),
  );
  await add(".", cwd);
  await commit("add changesets", cwd);
};

vi.setConfig({ testTimeout: 10000 });
silenceLogsInBlock();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("version", { tags: ["slow"] }, () => {
  it("returns the right changed packages and pushes to the remote", async () => {
    const cwd = await gitdir({
      ".gitattributes": "* text=auto eol=lf\n",
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
      ".changeset/config.json": JSON.stringify({}),
    });

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "pkg-a",
              type: "minor",
            },
            {
              name: "pkg-b",
              type: "minor",
            },
          ],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    const clone = await shallowClone(cwd);

    await linkNodeModules(clone);

    const { changedPackages } = await runVersion({
      cwd: clone,
    });

    await exec("git", ["checkout", "changeset-release/main"], {
      nodeOptions: { cwd },
    });

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "package.json"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(
      `"{"name":"pkg-a","version":"1.1.0","dependencies":{"pkg-b":"1.1.0"}}"`,
    );

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-b", "package.json"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`"{"name":"pkg-b","version":"1.1.0"}"`);
    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "CHANGELOG.md"),
        "utf8",
      ),
    ).toContain(`# pkg-a

## 1.1.0

### Minor Changes

`);
    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-b", "CHANGELOG.md"),
        "utf8",
      ),
    ).toContain(`# pkg-b

## 1.1.0

### Minor Changes

`);
    expect(changedPackages).toEqual([
      {
        dir: path.join(clone, "packages", "pkg-a"),
        relativeDir: path.join("packages", "pkg-a"),
        packageJson: {
          name: "pkg-a",
          version: "1.1.0",
          dependencies: {
            "pkg-b": "1.1.0",
          },
        },
      },
      {
        dir: path.join(clone, "packages", "pkg-b"),
        relativeDir: path.join("packages", "pkg-b"),
        packageJson: { name: "pkg-b", version: "1.1.0" },
      },
    ]);
  });

  it("only includes bumped packages in the returned changed packages", async () => {
    const cwd = await gitdir({
      ".gitattributes": "* text=auto eol=lf\n",
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
      "packages/pkg-b/package.json": JSON.stringify(
        {
          name: "pkg-b",
          version: "1.0.0",
        },
        null,
        2,
      ),
      ".changeset/config.json": JSON.stringify({}),
    });

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "pkg-a",
              type: "minor",
            },
          ],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    const clone = await shallowClone(cwd);

    await linkNodeModules(clone);

    const { changedPackages } = await runVersion({
      cwd: clone,
    });

    await exec("git", ["checkout", "changeset-release/main"], {
      nodeOptions: { cwd },
    });

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "package.json"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(
      `"{"name":"pkg-a","version":"1.1.0","dependencies":{"pkg-b":"1.0.0"}}"`,
    );

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-b", "package.json"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "{
        "name": "pkg-b",
        "version": "1.0.0"
      }"
    `);

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "CHANGELOG.md"),
        "utf8",
      ),
    ).toContain(`# pkg-a

## 1.1.0

### Minor Changes

`);
    await expect(
      fs.readFile(path.join(cwd, "packages", "pkg-b", "CHANGELOG.md"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(changedPackages).toEqual([
      {
        dir: path.join(clone, "packages", "pkg-a"),
        relativeDir: path.join("packages", "pkg-a"),
        packageJson: {
          name: "pkg-a",
          version: "1.1.0",
          dependencies: {
            "pkg-b": "1.0.0",
          },
        },
      },
    ]);
  });

  it("doesn't include ignored package that got a dependency update in returned versions", async () => {
    const cwd = await gitdir({
      ".gitattributes": "* text=auto eol=lf\n",
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
        ignore: ["pkg-a"],
      }),
    });

    await writeChangesets(
      [
        {
          releases: [{ name: "pkg-b", type: "minor" }],
          summary: "Awesome feature",
        },
      ],
      cwd,
    );

    const clone = await shallowClone(cwd);

    await linkNodeModules(clone);

    const { changedPackages } = await runVersion({ cwd: clone });
    expect(changedPackages).toEqual([
      {
        dir: path.join(clone, "packages", "pkg-b"),
        relativeDir: path.join("packages", "pkg-b"),
        packageJson: { name: "pkg-b", version: "1.1.0" },
      },
    ]);
  });
});

describe("publish", () => {
  it("publishes packages in a single package repo", async () => {
    const cwd = await gitdir({
      ".gitattributes": "* text=auto eol=lf\n",
      "package.json": JSON.stringify({
        private: true,
        name: "single-package",
        version: "1.0.0",
      }),
    });

    const clone = await shallowClone(cwd);
    await exec("git", ["checkout", "-b", "some-other-branch"], {
      nodeOptions: { cwd },
    });

    await linkNodeModules(clone);

    const gitModulePath = new URL("../../git/dist/index.mjs", import.meta.url)
      .href;

    const result = await runPublish({
      command: "node",
      args: [
        "-e",
        `const git = await import(${JSON.stringify(gitModulePath)}); console.log('🦋 New tag: v1.0.0'); git.tag('v1.0.0', process.cwd());`,
      ],
      cwd: clone,
    });

    expect(result).toEqual({
      published: true,
      publishedPackages: [{ name: "single-package", version: "1.0.0" }],
    });
    const tagsResult = await exec("git", ["tag"], { nodeOptions: { cwd } });
    expect(tagsResult.stdout.trim()).toEqual("v1.0.0");
  });

  it("publishes packages in a multi package repo", async () => {
    const cwd = await gitdir({
      ".gitattributes": "* text=auto eol=lf\n",
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
      ".changeset/config.json": JSON.stringify({}),
    });

    const clone = await shallowClone(cwd);
    await exec("git", ["checkout", "-b", "some-other-branch"], {
      nodeOptions: { cwd },
    });

    await linkNodeModules(clone);

    const gitModulePath = new URL("../../git/dist/index.mjs", import.meta.url)
      .href;

    const result = await runPublish({
      command: "node",
      args: [
        "-e",
        `const git = await import(${JSON.stringify(gitModulePath)}); console.log('🦋 New tag: pkg-a@1.0.0'); console.log('🦋 New tag: pkg-b@1.0.0'); git.tag('pkg-a@1.0.0', process.cwd()); git.tag('pkg-b@1.0.0', process.cwd());`,
      ],
      cwd: clone,
    });

    expect(result).toEqual({
      published: true,
      publishedPackages: [
        { name: "pkg-a", version: "1.0.0" },
        { name: "pkg-b", version: "1.0.0" },
      ],
    });
    const tagsResult = await exec("git", ["tag"], { nodeOptions: { cwd } });
    expect(tagsResult.stdout.trim()).toEqual("pkg-a@1.0.0\npkg-b@1.0.0");
  });
});
