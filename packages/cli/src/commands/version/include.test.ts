import fs from "node:fs/promises";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { ExitError } from "@changesets/errors";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { log } from "@clack/prompts";
import { describe, expect, it, vi } from "vitest";
import { cli } from "../../cli.ts";
import { pre } from "../pre/index.ts";
import { version } from "./index.ts";

vi.mock("@clack/prompts");

const aChangeset = '---\n"pkg-a": patch\n---\n\nRelease A.\n';
const bChangeset = '---\n"pkg-b": minor\n---\n\nRelease B.\n';
const aManifest = JSON.stringify({ name: "pkg-a", version: "1.0.0" });
const bManifest = JSON.stringify({ name: "pkg-b", version: "1.0.0" });

async function workspace(
  config: Record<string, unknown> = {},
  changesets: Record<string, string> = {
    ".changeset/a.md": aChangeset,
    ".changeset/b.md": bChangeset,
  },
  files: Record<string, string> = {},
) {
  return testdir({
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["packages/*"],
    }),
    "package-lock.json": "",
    "packages/pkg-a/package.json": aManifest,
    "packages/pkg-b/package.json": bManifest,
    ".changeset/config.json": JSON.stringify({
      changelog: false,
      commit: false,
      format: false,
      ...config,
    }),
    ...files,
    ...changesets,
  });
}

async function readFile(cwd: string, file: string) {
  return fs.readFile(path.join(cwd, file), "utf8");
}

async function getVersion(cwd: string, name: string) {
  return JSON.parse(await readFile(cwd, `packages/${name}/package.json`))
    .version;
}

silenceLogsInBlock();

describe("version include", () => {
  it.each([
    ["--include", ""],
    ["--include= "],
    ["--include", "pkg-a", "--include", ""],
  ])(
    "rejects empty CLI input %j without releasing a package named 0",
    async (...args) => {
      const zeroManifest = JSON.stringify({ name: "0", version: "1.0.0" });
      const zeroChangeset = '---\n"0": patch\n---\n\nRelease zero.\n';
      const cwd = await workspace(
        {},
        {
          ".changeset/a.md": aChangeset,
          ".changeset/b.md": bChangeset,
          ".changeset/zero.md": zeroChangeset,
        },
        { "packages/zero/package.json": zeroManifest },
      );
      vi.spyOn(process, "cwd").mockReturnValue(cwd);
      cli.parse(["node", "changeset", "version", ...args], { run: false });

      await expect(cli.runMatchedCommand()).rejects.toMatchObject({ code: 1 });
      expect(vi.mocked(log.error)).toHaveBeenCalledWith(
        "The `--include` option requires a nonempty package name.",
      );
      expect(await readFile(cwd, "packages/zero/package.json")).toBe(
        zeroManifest,
      );
      expect(await readFile(cwd, "packages/pkg-a/package.json")).toBe(
        aManifest,
      );
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/zero.md")).toBe(zeroChangeset);
      expect(await readFile(cwd, ".changeset/a.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
    },
  );

  it.each([
    { args: ["--include", "0"], expectedVersion: "1.0.1" },
    { args: ["--include", " , "], expectedVersion: "1.0.0" },
    {
      args: ["--include", "0", "--", "--include", ""],
      expectedVersion: "1.0.1",
    },
  ])(
    "handles actual CLI input $args without widening selection",
    async ({ args, expectedVersion }) => {
      const zeroManifest = JSON.stringify({ name: "0", version: "1.0.0" });
      const zeroChangeset = '---\n"0": patch\n---\n\nRelease zero.\n';
      const cwd = await workspace(
        {},
        {
          ".changeset/a.md": aChangeset,
          ".changeset/b.md": bChangeset,
          ".changeset/zero.md": zeroChangeset,
        },
        { "packages/zero/package.json": zeroManifest },
      );
      vi.spyOn(process, "cwd").mockReturnValue(cwd);
      cli.parse(["node", "changeset", "version", ...args], {
        run: false,
      });
      await cli.runMatchedCommand();
      expect(
        JSON.parse(await readFile(cwd, "packages/zero/package.json")).version,
      ).toBe(expectedVersion);
      expect(await readFile(cwd, "packages/pkg-a/package.json")).toBe(
        aManifest,
      );
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/a.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
      const zeroChangesetResult = await readFile(
        cwd,
        ".changeset/zero.md",
      ).catch((error: NodeJS.ErrnoException) => ({ code: error.code }));
      expect(zeroChangesetResult).toEqual(
        expectedVersion === "1.0.1" ? { code: "ENOENT" } : zeroChangeset,
      );
    },
  );

  it("still releases all packages without a selection", async () => {
    const cwd = await workspace();
    await version({ cwd });
    expect(
      JSON.parse(await readFile(cwd, "packages/pkg-a/package.json")).version,
    ).toBe("1.0.1");
    expect(
      JSON.parse(await readFile(cwd, "packages/pkg-b/package.json")).version,
    ).toBe("1.1.0");
  });

  it.each(["config", "CLI"] as const)(
    "releases only included packages via %s and retains excluded changesets",
    async (source) => {
      const cwd = await workspace(
        source === "config" ? { include: ["pkg-a"] } : {},
      );
      const options = source === "CLI" ? { include: ["pkg-a"] } : {};
      await version({ cwd, ...options });

      expect(
        JSON.parse(await readFile(cwd, "packages/pkg-a/package.json")).version,
      ).toBe("1.0.1");
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
      await expect(readFile(cwd, ".changeset/a.md")).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it.each(["config", "CLI"] as const)(
    "rejects a mixed changeset via %s before applying releases",
    async (source) => {
      const mixed =
        '---\n"pkg-a": patch\n"pkg-b": minor\n---\n\nRelease both.\n';
      const cwd = await workspace(
        source === "config" ? { include: ["pkg-a"] } : {},
        { ".changeset/mixed.md": mixed },
      );
      const options = source === "CLI" ? { include: ["pkg-a"] } : {};

      await expect(version({ cwd, ...options })).rejects.toThrow(
        "Found mixed changeset mixed",
      );
      expect(await readFile(cwd, "packages/pkg-a/package.json")).toBe(
        aManifest,
      );
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/mixed.md")).toBe(mixed);
    },
  );

  it.each(["config", "CLI"] as const)(
    "selects no packages with empty %s include",
    async (source) => {
      const cwd = await workspace(source === "config" ? { include: [] } : {});
      const options = source === "CLI" ? { include: [] } : {};
      await version({ cwd, ...options });
      expect(await readFile(cwd, "packages/pkg-a/package.json")).toBe(
        aManifest,
      );
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/a.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
    },
  );

  it.each([
    { config: {}, options: { include: ["pkg-a"], ignore: ["pkg-b"] } },
    { config: { include: ["pkg-a"] }, options: { include: ["pkg-b"] } },
    {
      config: { include: ["pkg-a", "pkg-b"] },
      options: { include: ["pkg-a"] },
    },
    { config: { include: [] }, options: { include: ["pkg-a"] } },
    { config: { include: ["pkg-a"] }, options: { ignore: ["pkg-b"] } },
    { config: { include: ["pkg-a", "pkg-b"] }, options: { ignore: ["pkg-b"] } },
    { config: { ignore: ["pkg-b"] }, options: { include: ["pkg-a"] } },
  ])(
    "rejects ambiguous selection $config / $options",
    async ({ config, options }) => {
      const cwd = await workspace(config);
      await expect(version({ cwd, ...options })).rejects.toThrow(ExitError);
      expect(vi.mocked(log.error)).toHaveBeenCalledWith(
        expect.stringContaining("include"),
      );
      expect(await readFile(cwd, "packages/pkg-a/package.json")).toBe(
        aManifest,
      );
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/a.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
    },
  );

  it.each(["missing", "pkg-*"])(
    "rejects unknown CLI include name %s",
    async (name) => {
      const cwd = await workspace();
      await expect(version({ cwd, ...{ include: [name] } })).rejects.toThrow(
        ExitError,
      );
      const error = stripVTControlCharacters(
        vi.mocked(log.error).mock.calls[0][0],
      );
      expect(error).toContain(name);
      expect(error).toContain("--include");
      expect(error).toContain("not found in the project");
      expect(await readFile(cwd, ".changeset/a.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
    },
  );

  it.each(["config", "CLI"] as const)(
    "rejects an included public dependent of an excluded package via %s",
    async (source) => {
      const dependent = JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        dependencies: { "pkg-b": "1.0.0" },
      });
      const cwd = await workspace(
        source === "config" ? { include: ["pkg-a"] } : {},
        undefined,
        { "packages/pkg-a/package.json": dependent },
      );
      const options = source === "CLI" ? { include: ["pkg-a"] } : {};
      await expect(version({ cwd, ...options })).rejects.toThrow(ExitError);
      const error = stripVTControlCharacters(
        vi.mocked(log.error).mock.calls[0][0],
      );
      expect(error).toContain("pkg-a");
      expect(error).toContain("pkg-b");
      expect(await readFile(cwd, "packages/pkg-a/package.json")).toBe(
        dependent,
      );
      expect(await readFile(cwd, ".changeset/a.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
    },
  );

  it.each([
    {
      name: "development",
      manifest: { devDependencies: { "pkg-b": "1.0.0" } },
      config: {},
    },
    {
      name: "private",
      manifest: { private: true, dependencies: { "pkg-b": "1.0.0" } },
      config: { privatePackages: { version: true } },
    },
  ])(
    "preserves the $name dependent exception",
    async ({ manifest, config }) => {
      const cwd = await workspace(
        { ...config, include: ["pkg-a"] },
        undefined,
        {
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            ...manifest,
          }),
        },
      );
      await version({ cwd });
      expect(await getVersion(cwd, "pkg-a")).toBe("1.0.1");
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
    },
  );

  it.each<{
    name: string;
    config: Record<string, unknown>;
    files: Record<string, string>;
    changesets: Record<string, string> | undefined;
  }>([
    {
      name: "fixed",
      config: { fixed: [["pkg-a", "pkg-b"]] },
      files: {},
      changesets: undefined,
    },
    {
      name: "linked",
      config: { linked: [["pkg-a", "pkg-b"]] },
      files: {},
      changesets: undefined,
    },
    {
      name: "excluded dependent range update",
      config: {},
      files: {
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
          dependencies: { "pkg-a": "1.0.0" },
        }),
      },
      changesets: {
        ".changeset/a.md": '---\n"pkg-a": major\n---\n\nRelease A.\n',
        ".changeset/b.md": bChangeset,
      },
    },
  ])(
    "matches complement ignore for $name",
    async ({ config, files, changesets }) => {
      const included = await workspace(
        { ...config, include: ["pkg-a"] },
        changesets,
        files,
      );
      const ignored = await workspace(
        { ...config, ignore: ["pkg-b"] },
        changesets,
        files,
      );
      await version({ cwd: included });
      await version({ cwd: ignored });
      for (const file of [
        "packages/pkg-a/package.json",
        "packages/pkg-b/package.json",
        ".changeset/b.md",
      ]) {
        expect(await readFile(included, file)).toBe(
          await readFile(ignored, file),
        );
      }
      expect(await getVersion(included, "pkg-b")).toBe("1.0.0");
      await expect(readFile(included, ".changeset/a.md")).rejects.toMatchObject(
        { code: "ENOENT" },
      );
    },
  );

  it.each(["config", "CLI"] as const)(
    "uses %s include through the prerelease lifecycle",
    async (source) => {
      const cwd = await workspace(
        source === "config" ? { include: ["pkg-a"] } : {},
      );
      const options = source === "CLI" ? { include: ["pkg-a"] } : {};
      await pre({ cwd, command: "enter", tag: "beta" });
      await version({ cwd, ...options });
      expect(await getVersion(cwd, "pkg-a")).toBe("1.0.1-beta.0");
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
      expect(await readFile(cwd, ".changeset/pre/a.md")).toBe(aChangeset);
      expect(JSON.parse(await readFile(cwd, ".changeset/pre.json"))).toEqual({
        mode: "pre",
        tag: "beta",
      });

      await fs.writeFile(path.join(cwd, ".changeset/next.md"), aChangeset);
      await version({ cwd, ...options });
      expect(await getVersion(cwd, "pkg-a")).toBe("1.0.1-beta.1");
      expect(await readFile(cwd, ".changeset/pre/next.md")).toBe(aChangeset);
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);

      await pre({ cwd, command: "exit" });
      await version({ cwd, ...options });
      expect(await getVersion(cwd, "pkg-a")).toBe("1.0.1");
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
      await expect(readFile(cwd, ".changeset/pre.json")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readFile(cwd, ".changeset/pre/a.md")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(
        readFile(cwd, ".changeset/pre/next.md"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it.each(["config", "CLI"] as const)(
    "uses %s include for snapshots",
    async (source) => {
      const cwd = await workspace(
        source === "config" ? { include: ["pkg-a"] } : {},
      );
      const options = source === "CLI" ? { include: ["pkg-a"] } : {};
      await version({ cwd, ...options, snapshot: "test" });
      expect(await getVersion(cwd, "pkg-a")).toMatch(/^0\.0\.0-test-/);
      expect(await readFile(cwd, "packages/pkg-b/package.json")).toBe(
        bManifest,
      );
      expect(await readFile(cwd, ".changeset/b.md")).toBe(bChangeset);
      await expect(readFile(cwd, ".changeset/a.md")).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );
});
