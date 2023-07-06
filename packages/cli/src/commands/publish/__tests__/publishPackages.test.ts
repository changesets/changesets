import publishPackages from "../publishPackages";
import * as npmUtils from "../npm-utils";
import { getPackages } from "@manypkg/get-packages";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { jest } from "@jest/globals";

jest.mock("../npm-utils");
jest.mock("ci-info", () => ({
  isCI: true,
}));

type Info404Mock = jest.MockedFunction<typeof npmUtils.infoAllow404>;
type PublishMock = jest.MockedFunction<typeof npmUtils.publish>;

describe("publishPackages", () => {
  let cwd: string;

  silenceLogsInBlock();

  beforeEach(async () => {
    cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    (npmUtils.infoAllow404 as Info404Mock).mockImplementation(() =>
      Promise.resolve({
        published: false,
        pkgInfo: {
          version: "1.0.0",
        },
      })
    );

    (npmUtils.publish as PublishMock).mockImplementation(() =>
      Promise.resolve({ published: true })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when isCI", () => {
    it("does not call out to npm to see if otp is required", async () => {
      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        preState: undefined,
      });
      expect(npmUtils.getTokenIsRequired).not.toHaveBeenCalled();
    });
  });

  describe("--dry-run", () => {
    it("passes the --dry-run option to the underlying publish command", async () => {
      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        preState: undefined,
        dryRun: true,
      });
      expect(npmUtils.publish).toHaveBeenCalledWith(
        "pkg-a",
        {
          cwd: `${cwd}/packages/pkg-a`,
          publishDir: `${cwd}/packages/pkg-a`,
          access: "public",
          tag: "latest",
          dryRun: true,
        },
        {
          isRequired: expect.any(Promise),
          token: null,
        }
      );
    });
  });

  describe("without --dry-run", () => {
    it("doesn't pass the --dry-run option to the underlying publish command when not specified", async () => {
      await publishPackages({
        packages: (await getPackages(cwd)).packages,
        access: "public",
        preState: undefined,
        dryRun: false,
      });
      expect(npmUtils.publish).toHaveBeenCalledWith(
        "pkg-a",
        {
          cwd: `${cwd}/packages/pkg-a`,
          publishDir: `${cwd}/packages/pkg-a`,
          access: "public",
          tag: "latest",
          dryRun: false,
        },
        {
          isRequired: expect.any(Promise),
          token: null,
        }
      );
    });
  });
});
