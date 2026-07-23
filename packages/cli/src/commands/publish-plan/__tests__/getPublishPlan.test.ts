import { readConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishTool } from "../../../lib/types.ts";
import * as getPublishToolModule from "../../publish/getPublishTool.ts";
import { getPublishPlan } from "../getPublishPlan.ts";

vi.mock("@changesets/git");
vi.mock("../../publish/getPublishTool.ts");

const mockedGetPublishTool = vi.mocked(getPublishToolModule);
const mockedGit = vi.mocked(git);
const mockedInfo = vi.fn<PublishTool["info"]>();

describe("getPublishPlan", () => {
  silenceLogsInBlock();

  beforeEach(() => {
    mockedGetPublishTool.getPublishTool.mockResolvedValue({
      name: "npm",
      getOtpCode: () => null,
      info: mockedInfo,
      pack: vi.fn<PublishTool["pack"]>(),
      publish: vi.fn<PublishTool["publish"]>(),
    });
  });

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

    mockedInfo.mockResolvedValue({
      published: false,
    });
    mockedGit.getAllTags.mockResolvedValue(new Set());
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
          isNew: true,
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
    expect(mockedInfo).not.toHaveBeenCalled();
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

    mockedInfo.mockResolvedValue({
      published: false,
    });
    mockedGit.getAllTags.mockResolvedValue(new Set());
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
          isNew: true,
        },
      ],
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
          isNew: true,
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

    mockedInfo.mockResolvedValue({
      published: false,
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
          isNew: true,
        },
        {
          kind: "publish",
          name: "pkg-b",
          version: "1.0.0",
          access: "restricted",
          tag: "latest",
          isNew: true,
        },
      ],
    ]);
  });

  it("uses latest tag when all published versions are prereleases for the current pre tag", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "repo",
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".changeset/config.json": JSON.stringify({}),
      ".changeset/pre.json": JSON.stringify({
        mode: "pre",
        tag: "next",
        initialVersions: {},
        changesets: [],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-next.3",
      }),
    });

    mockedInfo.mockResolvedValue({
      published: true,
      info: {
        versions: ["1.0.0-next.1", "1.0.0-next.2"],
        "dist-tags": {
          latest: "1.0.0-next.2",
        },
      },
    });

    const config = await readConfig(cwd);
    const result = await getPublishPlan(cwd, config.config!);

    expect(result).toEqual([
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0-next.3",
          access: "restricted",
          tag: "latest",
          isNew: false,
        },
      ],
    ]);
  });

  it("includes a package when it is published but the local version is not", async () => {
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
        version: "1.1.0",
      }),
    });

    mockedInfo.mockResolvedValue({
      published: true,
      info: {
        "dist-tags": {},
        versions: ["1.0.0"],
      },
    });

    const config = await readConfig(cwd);
    const result = await getPublishPlan(cwd, config.config!);

    expect(result).toEqual([
      [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.1.0",
          access: "restricted",
          tag: "latest",
          isNew: false,
        },
      ],
    ]);
  });
});
