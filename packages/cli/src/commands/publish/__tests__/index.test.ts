import publishCommand from "../index";
import * as publishPackages from "../publishPackages";
import { defaultConfig } from "@changesets/config";
import * as path from "path";
import * as git from "@changesets/git";
import { Config } from "@changesets/types";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { jest } from "@jest/globals";

jest.mock("../publishPackages");
jest.mock("@changesets/git");

let changelogPath = path.resolve(__dirname, "../../changelog");
let modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};

type PublishPackagesMock = jest.MockedFunction<typeof publishPackages.default>;
type GitTagMock = jest.MockedFunction<typeof git.tag>;

describe("Publish command", () => {
  silenceLogsInBlock();

  describe("git tag", () => {
    let cwd: string;

    beforeEach(async () => {
      (publishPackages.default as PublishPackagesMock).mockImplementation(
        async () => [
          {
            name: "pkg-a",
            newVersion: "1.1.0",
            published: true,
          },
          {
            name: "pkg-b",
            newVersion: "3.0.0",
            published: true,
          },
        ]
      );

      (git.tag as GitTagMock).mockImplementation(async () => true);

      cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "2.0.0",
        }),
      });
    });

    describe("with dryRun option", () => {
      it("doesn't create any tags", async () => {
        await publishCommand(
          cwd,
          { gitTag: true, dryRun: true },
          modifiedDefaultConfig
        );
        expect(git.tag).not.toHaveBeenCalled();
      });
    });

    describe("without dryRun option", () => {
      it("creates a git tag", async () => {
        await publishCommand(cwd, { gitTag: true }, modifiedDefaultConfig);
        expect(git.tag).toHaveBeenCalledTimes(2);
        expect(git.tag).toHaveBeenCalledWith("pkg-a@1.1.0", cwd);
        expect(git.tag).toHaveBeenCalledWith("pkg-b@3.0.0", cwd);
      });
    });
  });

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
});
