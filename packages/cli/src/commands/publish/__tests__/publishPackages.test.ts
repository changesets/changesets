import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { getPackages } from "@manypkg/get-packages";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getUnpublishedPackages } from "../../publish-plan/getPublishPlan.ts";
import * as npmUtils from "../npm-utils.ts";
import { publishPackages } from "../publishPackages.ts";

vi.mock("../npm-utils");
const mockedNpmUtils = vi.mocked(npmUtils);

describe("publishPackages", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips ignored public packages", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    await publishPackages({
      packages: (await getPackages(cwd)).packages,
      access: "public",
      ignore: ["pkg-a"],
      allowPrivatePackages: false,
      preState: undefined,
    });

    expect(mockedNpmUtils.infoAllow404).not.toHaveBeenCalled();
    expect(mockedNpmUtils.publish).not.toHaveBeenCalled();
  });

  describe("when not in isTTY", () => {
    it("does not call out to npm to see if otp is required", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
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

      mockedNpmUtils.publish.mockImplementation(async () => ({
        result: "published",
      }));

      const packages = await getPackages(cwd);
      const releases = await getUnpublishedPackages(
        packages,
        undefined,
        "public",
        {
          ignore: [],
          allowPrivatePackages: false,
        },
      );

      await publishPackages({
        releases,
        packages: packages.packages,
        access: "public",
      });
      expect(mockedNpmUtils.getTokenIsRequired).not.toHaveBeenCalled();
    });
  });
});
