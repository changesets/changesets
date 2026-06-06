import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTarball } from "../../../utils/tarball.ts";
import * as npmUtils from "../../publish/npm-utils.ts";
import { pack } from "../index.ts";

vi.mock("@changesets/git");
vi.mock("tinyexec");
vi.mock("../../publish/npm-utils.ts");

const mockedExec = vi.mocked(exec);
const mockedGit = vi.mocked(git);
const mockedNpmUtils = vi.mocked(npmUtils);

function execResult(stdout: string, exitCode = 0) {
  return {
    command: "",
    args: [],
    stdout,
    stderr: "",
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
const tarballChecksum = createHash("sha256")
  .update(tarballContents)
  .digest("hex");

async function readOuterTarball(tarballPath: string) {
  const extractDir = `${tarballPath}.extract`;
  await extractTarball(tarballPath, extractDir);

  return new Map<string, string>([
    [
      "publish-plan.json",
      await fs.readFile(path.join(extractDir, "publish-plan.json"), "utf8"),
    ],
    [
      "packages/pkg-a-1.0.0.tgz",
      await fs.readFile(
        path.join(extractDir, "packages", "pkg-a-1.0.0.tgz"),
        "utf8",
      ),
    ],
  ]);
}

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

    vi.spyOn(fs, "mkdtemp").mockResolvedValue(outputDir);
    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    });
    mockedNpmUtils.getPublishTool.mockResolvedValue({ name: "npm" } as never);
    mockedGit.tagExists.mockResolvedValue(false);
    mockedGit.remoteTagExists.mockResolvedValue(false);
    mockExecImplementation(async (cmd, args) => {
      const dest = args[args.indexOf("--pack-destination") + 1];
      const tarballFilename = "pkg-a-1.0.0.tgz";
      await fs.mkdir(dest, { recursive: true });
      await fs.writeFile(path.join(dest, tarballFilename), tarballContents);
      return execResult(JSON.stringify([{ filename: tarballFilename }]));
    });

    const result = await pack({ cwd });

    expect(result).toEqual({
      tarballPath: path.join(cwd, "changesets-pack.tgz"),
    });

    await expect(fs.readFile(path.join(outputDir, "publish-plan.json"), "utf8"))
      .resolves.toMatchInlineSnapshot(`
      "[
        [
          {
            "kind": "publish",
            "name": "pkg-a",
            "version": "1.0.0",
            "access": "restricted",
            "registry": "https://registry.npmjs.org",
            "tag": "latest",
            "tarball": {
              "path": "packages/pkg-a-1.0.0.tgz",
              "checksum": "db4b4d0d1cb480bf9aeea253771c00febe627f236765fa37d6a5614f079a3aa0"
            }
          },
          {
            "kind": "tag-only",
            "name": "pkg-b",
            "version": "1.0.0"
          }
        ]
      ]"
    `);
    await expect(fs.stat(result.tarballPath!)).resolves.toMatchObject({
      isFile: expect.any(Function),
    });

    const entries = await readOuterTarball(result.tarballPath!);
    expect([...entries.keys()].toSorted()).toEqual([
      "packages/pkg-a-1.0.0.tgz",
      "publish-plan.json",
    ]);
    expect(entries.get("publish-plan.json")).toContain(
      `"checksum": "${tarballChecksum}"`,
    );
    expect(entries.get("packages/pkg-a-1.0.0.tgz")).toBe(tarballContents);
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
          registry: "https://registry.npmjs.org",
          tag: "latest",
        },
        {
          kind: "tag-only",
          name: "pkg-b",
          version: "1.0.0",
        },
      ],
    ];

    vi.spyOn(fs, "mkdtemp").mockResolvedValue(outputDir);
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    });
    mockedNpmUtils.getPublishTool.mockResolvedValue({ name: "npm" } as never);
    await fs.writeFile(
      path.join(cwd, "publish-plan.json"),
      JSON.stringify(plan, undefined, 2),
    );
    mockExecImplementation(async (cmd, args) => {
      const dest = args[args.indexOf("--pack-destination") + 1];
      const tarballFilename = "pkg-a-1.0.0.tgz";
      await fs.mkdir(dest, { recursive: true });
      await fs.writeFile(path.join(dest, tarballFilename), tarballContents);
      return execResult(JSON.stringify([{ filename: tarballFilename }]));
    });

    const result = await pack({ cwd, from: "publish-plan.json" });

    expect(result).toEqual({
      tarballPath: path.join(cwd, "changesets-pack.tgz"),
    });

    await expect(
      fs.readFile(path.join(outputDir, "publish-plan.json"), "utf8"),
    ).resolves.toContain(`"checksum": "${tarballChecksum}"`);
    await expect(fs.stat(result.tarballPath!)).resolves.toMatchObject({
      isFile: expect.any(Function),
    });
  });
});
