import publishCommand from "../index";
import { defaultConfig } from "@changesets/config";
import * as path from "path";
import * as git from "@changesets/git";
import * as npmUtils from "../npm-utils";
import { Config } from "@changesets/types";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";

jest.mock("@changesets/git");
jest.mock("../npm-utils");
jest.mock("ci-info", () => ({
  isCI: true,
}));

let changelogPath = path.resolve(__dirname, "../../changelog");
let modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};

describe("Publish command", () => {
  silenceLogsInBlock();

  describe("in pre state", () => {
    it("should report error if the tag option is used in pre release", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/pre.json": JSON.stringify({
          mode: "pre",
        }),
      });
      await expect(
        publishCommand(cwd, { tag: "experimental" }, modifiedDefaultConfig)
      ).rejects.toThrowError();
    });
  });

  describe("git tag format", () => {
    beforeEach(() => {
      (git.getAllTags as jest.Mock).mockReturnValue(new Set());
    });

    it("should work", async () => {
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

      await publishCommand(
        cwd,
        { gitTagFormat: "{projectName}@v{version}" },
        defaultConfig
      );

      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-a@v1.0.0");
    });

    afterEach(() => {
      jest.clearAllMocks();
    });
  });
});
