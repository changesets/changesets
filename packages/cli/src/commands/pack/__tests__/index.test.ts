import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pack } from "../index.ts";

const mockedLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@clack/prompts", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    log: mockedLogger,
  };
});

vi.mock("@changesets/git");
vi.mock("tinyexec");

const mockedExec = vi.mocked(exec);
const mockedGit = vi.mocked(git);

function execResult(stdout: string, exitCode = 0, stderr = "") {
  return {
    command: "",
    args: [],
    stdout,
    stderr,
    exitCode,
    failed: exitCode !== 0,
    signal: undefined,
    killed: false,
  };
}

function mockExecImplementation(
  fn: (
    cmd: string,
    args: readonly string[],
  ) => Promise<ReturnType<typeof execResult>>,
) {
  mockedExec.mockImplementation(((cmd: string, args?: readonly string[]) =>
    Promise.resolve(fn(cmd, args ?? []))) as any);
}

const tarballContents = "tarball";
const tarballIntegrity = `sha256-${createHash("sha256")
  .update(tarballContents)
  .digest("base64")}`;

describe("pack", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("packs publish releases and writes an enriched publish plan", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({
        privatePackages: { version: true, tag: true },
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
        private: true,
      }),
    });
    const outputDir = path.join(cwd, ".packed");
    mockedGit.getAllTags.mockResolvedValue(new Set());
    mockedGit.remoteTagExists.mockResolvedValue(false);
    mockExecImplementation(async (cmd, args) => {
      if (cmd === "npm" && args[0] === "info") {
        return execResult(JSON.stringify({ versions: [] }));
      }

      const dest = args[args.indexOf("--pack-destination") + 1];
      const tarballFilename = "pkg-a-1.0.0.tgz";
      await fs.mkdir(dest, { recursive: true });
      await fs.writeFile(path.join(dest, tarballFilename), tarballContents);
      return execResult(JSON.stringify([{ filename: tarballFilename }]));
    });

    await pack({ cwd, outDir: ".packed" });

    await expect(fs.readFile(path.join(outputDir, "publish-plan.json"), "utf8"))
      .resolves.toMatchInlineSnapshot(`
      "{
        "version": 1,
        "plan": [
          [
            {
              "kind": "publish",
              "name": "pkg-a",
              "version": "1.0.0",
              "access": "restricted",
              "tag": "latest",
              "tarball": {
                "path": "packages/pkg-a-1.0.0.tgz",
                "integrity": "sha256-20tNDRy0gL+a7qJTdxwA/r5ifyNnZfo31qVhTweaOqA="
              }
            },
            {
              "kind": "tag-only",
              "name": "pkg-b",
              "version": "1.0.0"
            }
          ]
        ]
      }"
    `);
    await expect(
      fs.readFile(path.join(outputDir, "packages", "pkg-a-1.0.0.tgz"), "utf8"),
    ).resolves.toBe(tarballContents);
  });

  it("packs from an existing plan file", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({}),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });
    const outputDir = path.join(cwd, ".packed");
    const plan = [
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "public",
          tag: "latest",
        },
        {
          kind: "tag-only",
          name: "pkg-b",
          version: "1.0.0",
        },
      ],
    ];

    await fs.writeFile(
      path.join(cwd, "publish-plan.json"),
      JSON.stringify({ version: 1, plan }, undefined, 2),
    );
    mockExecImplementation(async (cmd, args) => {
      const dest = args[args.indexOf("--pack-destination") + 1];
      const tarballFilename = "pkg-a-1.0.0.tgz";
      await fs.mkdir(dest, { recursive: true });
      await fs.writeFile(path.join(dest, tarballFilename), tarballContents);
      return execResult(JSON.stringify([{ filename: tarballFilename }]));
    });

    await pack({
      cwd,
      fromPublishPlan: "publish-plan.json",
      outDir: ".packed",
    });

    await expect(
      fs.readFile(path.join(outputDir, "publish-plan.json"), "utf8"),
    ).resolves.toContain(`"integrity": "${tarballIntegrity}"`);
    await expect(
      fs.readFile(path.join(outputDir, "packages", "pkg-a-1.0.0.tgz"), "utf8"),
    ).resolves.toBe(tarballContents);
  });

  it("throws on an unsupported plan file version", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({}),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    await fs.writeFile(
      path.join(cwd, "publish-plan.json"),
      JSON.stringify({ version: 2, plan: [] }, undefined, 2),
    );

    await expect(
      pack({
        cwd,
        fromPublishPlan: "publish-plan.json",
        outDir: ".packed",
      }),
    ).rejects.toThrow(/Invalid publish plan file version/);
  });
});
