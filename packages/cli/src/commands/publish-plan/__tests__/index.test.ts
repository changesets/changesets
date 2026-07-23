import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishTool } from "../../../lib/types.ts";
import * as getPublishToolModule from "../../publish/getPublishTool.ts";
import { publishPlan } from "../index.ts";

vi.mock("@changesets/git");
vi.mock("../../publish/getPublishTool.ts");

const mockedGetPublishTool = vi.mocked(getPublishToolModule);
const mockedGit = vi.mocked(git);
const mockedInfo = vi.fn<PublishTool["info"]>();

describe("publish-plan", () => {
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

    const result = await publishPlan({ cwd });

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

    mockedInfo.mockResolvedValue({
      published: true,
      info: {
        "dist-tags": {},
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

    mockedInfo.mockResolvedValue({
      published: false,
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
          isNew: true,
        },
      ],
    ]);
    await expect(fs.readFile(path.join(cwd, output), "utf8")).resolves.toEqual(
      `${JSON.stringify({ version: 1, plan: result }, undefined, 2)}`,
    );
  });
});
