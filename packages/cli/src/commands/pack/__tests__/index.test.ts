import fs from "node:fs/promises";
import path from "node:path";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../../publish/npm-utils.ts";
import * as getUntaggedPackagesModule from "../../../utils/getUntaggedPackages.ts";
import { pack } from "../index.ts";
import { exec } from "tinyexec";

vi.mock("tinyexec");
vi.mock("../../publish/npm-utils.ts");
vi.mock("../../../utils/getUntaggedPackages.ts");

const mockedExec = vi.mocked(exec);
const mockedNpmUtils = vi.mocked(npmUtils);
const mockedGetUntaggedPackages = vi.mocked(
  getUntaggedPackagesModule.getUntaggedPackages,
);

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
    } as never);
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    } as never);
    mockedNpmUtils.getPublishTool.mockResolvedValue({ name: "npm" } as never);
    mockedGetUntaggedPackages.mockResolvedValue([
      { name: "pkg-b", newVersion: "1.0.0" },
    ] as never);
    mockedExec.mockImplementation(async (cmd, args) => {
      const dest = args[args.indexOf("--pack-destination") + 1];
      const tarballFilename = "pkg-a-1.0.0.tgz";
      await fs.mkdir(dest, { recursive: true });
      await fs.writeFile(path.join(dest, tarballFilename), "tarball");
      return execResult(JSON.stringify([{ filename: tarballFilename }]));
    });

    const result = await pack({ cwd });

    expect(result).toEqual([
      {
        name: "pkg-a",
        version: "1.0.0",
        tarballFilename: "pkg-a-1.0.0.tgz",
      },
    ]);

    await expect(
      fs.readFile(path.join(outputDir, "publish-plan.json"), "utf8"),
    ).resolves.toMatchInlineSnapshot(`
      "[
        [
          {
            "kind": "publish",
            "name": "pkg-a",
            "version": "1.0.0",
            "access": "restricted",
            "registry": "https://registry.npmjs.org",
            "tag": "latest",
            "tarballFilename": "pkg-a-1.0.0.tgz"
          },
          {
            "kind": "tag-only",
            "name": "pkg-b",
            "version": "1.0.0"
          }
        ]
      ]"
    `);
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
    mockedNpmUtils.getPublishTool.mockResolvedValue({ name: "npm" } as never);
    await fs.writeFile(
      path.join(cwd, "publish-plan.json"),
      JSON.stringify(plan, undefined, 2),
    );
    mockedExec.mockImplementation(async (cmd, args) => {
      const dest = args[args.indexOf("--pack-destination") + 1];
      const tarballFilename = "pkg-a-1.0.0.tgz";
      await fs.mkdir(dest, { recursive: true });
      await fs.writeFile(path.join(dest, tarballFilename), "tarball");
      return execResult(JSON.stringify([{ filename: tarballFilename }]));
    });

    const result = await pack({ cwd, from: "publish-plan.json" });

    expect(result).toEqual([
      {
        name: "pkg-a",
        version: "1.0.0",
        tarballFilename: "pkg-a-1.0.0.tgz",
      },
    ]);

    await expect(
      fs.readFile(path.join(outputDir, "publish-plan.json"), "utf8"),
    ).resolves.toContain(`"tarballFilename": "pkg-a-1.0.0.tgz"`);
  });
});
