import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../../publish/npm-utils.ts";
import { publishPlan } from "../index.ts";

vi.mock("@changesets/git");
vi.mock("../../publish/npm-utils.ts");

const mockedNpmUtils = vi.mocked(npmUtils);
const mockedGit = vi.mocked(git);

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

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedGit.tagExists.mockResolvedValue(false);
    mockedGit.remoteTagExists.mockResolvedValue(false);

    const result = await publishPlan({ cwd });

    expect(result).toEqual([
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
        },
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

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: true,
      pkgInfo: {
        version: "1.0.0",
        versions: ["1.0.0"],
      },
    });

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

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });

    const output = "publish-plan.json";
    const result = await publishPlan({ cwd, output });

    expect(result).toEqual([
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
        },
      ],
    ]);
    await expect(fs.readFile(path.join(cwd, output), "utf8")).resolves.toEqual(
      `${JSON.stringify({ version: 1, plan: result }, undefined, 2)}`,
    );
  });
});
