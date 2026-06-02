import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../../publish/npm-utils.ts";
import { publishPlan } from "../index.ts";

vi.mock("../../publish/npm-utils.ts");
const mockedNpmUtils = vi.mocked(npmUtils);

describe("publish-plan", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns publish and tag-only entries", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      ".changeset/config.json": JSON.stringify({ privatePackages: { tag: true } }),
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
        private: true,
        workspaces: ["packages/*"],
      }),
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

    const result = await publishPlan({ cwd });

    expect(result).toEqual([]);
  });
});
