import fs from "node:fs/promises";
import path from "node:path";
import { gitdir, silenceLogsInBlock } from "@changesets/test-utils";
import { writeChangeset } from "@changesets/write";
import { afterEach, describe, expect, it, vi } from "vitest";
import { check } from "../index.ts";

describe("check", { tags: ["slow"] }, () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup(cwd: string) {
    return {
      writeChangesetFile: async (
        name: string,
        contents: string,
      ): Promise<void> => {
        await fs.writeFile(
          path.join(cwd, ".changeset", `${name}.md`),
          contents,
        );
      },
    };
  }

  it("passes when all changesets are valid and reference existing packages", async () => {
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

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
    );

    await expect(check({ cwd })).resolves.toBeUndefined();
  });

  it("passes when there are no changesets", async () => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({}),
    });

    await expect(check({ cwd })).resolves.toBeUndefined();
  });

  it("passes for an empty changeset (created with --empty)", async () => {
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

    const { writeChangesetFile } = await setup(cwd);
    await writeChangesetFile("empty", "---\n---\n");

    await expect(check({ cwd })).resolves.toBeUndefined();
  });

  it("fails when a changeset references a package that does not exist in the workspace", async () => {
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

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "deleted-pkg", type: "minor" }],
      },
      cwd,
    );

    await expect(check({ cwd })).rejects.toThrow();
  });

  it("fails when a changeset has malformed frontmatter", async () => {
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

    const { writeChangesetFile } = await setup(cwd);
    await writeChangesetFile(
      "malformed",
      "This is not a valid changeset - no frontmatter",
    );

    await expect(check({ cwd })).rejects.toThrow();
  });

  it("fails when a changeset has an invalid version type", async () => {
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

    const { writeChangesetFile } = await setup(cwd);
    await writeChangesetFile(
      "bad-version",
      '---\n"pkg-a": not-a-version-type\n---\n\nSummary\n',
    );

    await expect(check({ cwd })).rejects.toThrow();
  });

  it("does not require changed packages to have changesets (unlike status)", async () => {
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
      "packages/pkg-a/a.js": 'export default "a"',
      ".changeset/config.json": JSON.stringify({}),
    });

    // No changeset exists, but there's a package with a source file.
    // `status` would fail here; `check` should pass (it only validates
    // existing changesets, not whether changesets exist for changes).
    await expect(check({ cwd })).resolves.toBeUndefined();
  });
});
