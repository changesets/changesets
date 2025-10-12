import { afterEach, describe, expect, it, vi } from "vitest";
import publishPackages from "../publishPackages.ts";
import * as npmUtils from "../npm-utils.ts";
import { getPackages } from "@manypkg/get-packages";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";

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
        published: true,
      }));

      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        preState: undefined,
      });
      expect(mockedNpmUtils.getTokenIsRequired).not.toHaveBeenCalled();
    });
  });
});
