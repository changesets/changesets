import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { getPackages } from "@manypkg/get-packages";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../npm-utils.ts";
import { publishPackages } from "../publishPackages.ts";

vi.mock("../npm-utils");
const mockedNpmUtils = vi.mocked(npmUtils);
vi.mock("ci-info", () => ({
  isCI: true,
}));

describe("publishPackages", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("when isCI", () => {
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

      mockedNpmUtils.publish.mockImplementation(async () => ({
        result: "published",
      }));

      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        ignore: [],
        allowPrivatePackages: false,
        preState: undefined,
      });
      expect(mockedNpmUtils.getTokenIsRequired).not.toHaveBeenCalled();
    });
  });
});
