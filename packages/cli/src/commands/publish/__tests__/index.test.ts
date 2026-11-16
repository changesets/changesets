import publishCommand from "../index";
import { defaultConfig } from "@changesets/config";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Config } from "@changesets/types";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";

const execFileAsync = promisify(execFile);

let changelogPath = path.resolve(__dirname, "../../changelog");
let modifiedDefaultConfig: Config = {
  ...defaultConfig,
  changelog: [changelogPath, null],
};

async function git(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function gitInit(cwd: string) {
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.email", "test@example.com"]);
  await git(cwd, ["config", "user.name", "Test User"]);
  await git(cwd, ["add", "-A"]);
  await git(cwd, ["commit", "-m", "initial commit"]);
}

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

  describe("for private packages", () => {
    const privatePackagesConfig: Config = {
      ...defaultConfig,
      privatePackages: { version: true, tag: true },
    };

    async function privatePackageTestdir() {
      return testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "0.1.0",
          private: true,
        }),
      });
    }

    it("should create git tags for untagged private packages by default", async () => {
      const cwd = await privatePackageTestdir();
      await gitInit(cwd);

      await publishCommand(cwd, {}, privatePackagesConfig);

      expect(await git(cwd, ["tag", "-l"])).toBe("pkg-a@0.1.0");
    });

    it("should not create git tags for untagged private packages if `gitTag` is false", async () => {
      const cwd = await privatePackageTestdir();
      await gitInit(cwd);

      await publishCommand(cwd, { gitTag: false }, privatePackagesConfig);

      expect(await git(cwd, ["tag", "-l"])).toBe("");
    });
  });
});
