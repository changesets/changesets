import fs from "node:fs/promises";
import path from "node:path";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../../publish/npm-utils.ts";
import * as getUntaggedPackagesModule from "../../../utils/getUntaggedPackages.ts";
import { publishPlan } from "../index.ts";

vi.mock("../../publish/npm-utils.ts");
vi.mock("../../../utils/getUntaggedPackages.ts");
const mockedNpmUtils = vi.mocked(npmUtils);
const mockedGetUntaggedPackages = vi.mocked(
  getUntaggedPackagesModule.getUntaggedPackages,
);

describe("publish-plan", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns publish and tag-only entries", async () => {
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

    mockedNpmUtils.infoAllow404.mockImplementation(async () => ({
      published: false,
      pkgInfo: {
        version: "1.0.0",
      },
    }));
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    } as never);
    mockedGetUntaggedPackages.mockResolvedValue([
      { name: "pkg-b", newVersion: "1.0.0" },
    ] as never);

    const result = await publishPlan({ cwd });

    expect(result).toEqual([
      [
        expect.objectContaining({
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "restricted",
          registry: "https://registry.npmjs.org",
          tag: "latest",
        }),
        {
          kind: "tag-only",
          name: "pkg-b",
          version: "1.0.0",
        },
      ],
    ]);
  });

  it("returns empty arrays when there is nothing to publish or tag", async () => {
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

    mockedNpmUtils.infoAllow404.mockImplementation(async () => ({
      published: true,
      pkgInfo: {
        version: "1.0.0",
        versions: ["1.0.0"],
      },
    }));
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    } as never);
    mockedGetUntaggedPackages.mockResolvedValue([] as never);

    const result = await publishPlan({ cwd });

    expect(result).toEqual([]);
  });

  it("writes the plan to the output file", async () => {
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

    mockedNpmUtils.infoAllow404.mockImplementation(async () => ({
      published: false,
      pkgInfo: {
        version: "1.0.0",
      },
    }));
    mockedNpmUtils.getCorrectRegistry.mockReturnValue({
      registry: "https://registry.npmjs.org",
    } as never);
    mockedGetUntaggedPackages.mockResolvedValue([] as never);

    const output = "publish-plan.json";
    const result = await publishPlan({ cwd, output });

    expect(result).toEqual([
      [
        expect.objectContaining({
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
        }),
      ],
    ]);

    await expect(fs.readFile(path.join(cwd, output), "utf8")).resolves.toEqual(
      `${JSON.stringify(result, undefined, 2)}`,
    );
  });
});
