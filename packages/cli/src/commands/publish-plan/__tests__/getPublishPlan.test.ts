import { readConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../../publish/npm-utils.ts";
import { getPublishPlan } from "../getPublishPlan.ts";

vi.mock("@changesets/git");
vi.mock("../../publish/npm-utils.ts");

const mockedNpmUtils = vi.mocked(npmUtils);
const mockedGit = vi.mocked(git);

describe("getPublishPlan", () => {
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

    const config = await readConfig(cwd);
    const result = await getPublishPlan(cwd, config.config!);

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

  it("skips ignored public packages", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({
        ignore: ["pkg-a"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const config = await readConfig(cwd);
    const result = await getPublishPlan(cwd, config.config!);

    expect(result).toEqual([]);
    expect(mockedNpmUtils.infoAllow404).not.toHaveBeenCalled();
  });

  it("chunks releases in dependency order", async () => {
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
        dependencies: {
          "pkg-b": "workspace:*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
      }),
      "packages/pkg-c/package.json": JSON.stringify({
        name: "pkg-c",
        version: "1.0.0",
        private: true,
        peerDependencies: {
          "pkg-a": "workspace:*",
        },
      }),
    });

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    mockedGit.tagExists.mockResolvedValue(false);
    mockedGit.remoteTagExists.mockResolvedValue(false);

    const config = await readConfig(cwd);
    const result = await getPublishPlan(cwd, config.config!);

    expect(result).toEqual([
      [
        {
          kind: "publish",
          name: "pkg-b",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
        },
      ],
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
        },
      ],
      [
        {
          kind: "tag-only",
          name: "pkg-c",
          version: "1.0.0",
        },
      ],
    ]);
  });

  it("keeps cyclic dependencies in one chunk", async () => {
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
        dependencies: {
          "pkg-b": "workspace:*",
        },
      }),
      "packages/pkg-b/package.json": JSON.stringify({
        name: "pkg-b",
        version: "1.0.0",
        peerDependencies: {
          "pkg-a": "workspace:*",
        },
      }),
    });

    mockedNpmUtils.infoAllow404.mockResolvedValue({
      published: false,
      pkgInfo: { version: "1.0.0" },
    });
    const config = await readConfig(cwd);
    const result = await getPublishPlan(cwd, config.config!);

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
          kind: "publish",
          name: "pkg-b",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
        },
      ],
    ]);
  });
});
