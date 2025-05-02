import { vi } from "vitest";
import publishPackages from "../publishPackages.ts";
import * as npmUtils from "../npm-utils.ts";
import { getPackages } from "@manypkg/get-packages";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";

vi.mock("../npm-utils");
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

      // @ts-ignore
      npmUtils.infoAllow404.mockImplementation(() => ({
        published: false,
        pkgInfo: {
          version: "1.0.0",
        },
      }));

      // @ts-ignore
      npmUtils.publish.mockImplementation(() => ({
        published: true,
      }));

      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        preState: undefined,
      });
      expect(npmUtils.getTokenIsRequired).not.toHaveBeenCalled();
    });
  });
});
