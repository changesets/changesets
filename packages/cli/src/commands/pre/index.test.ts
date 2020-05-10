import fixturez from "fixturez";
import path from "path";
import chalk from "chalk";
import * as fs from "fs-extra";
import * as git from "@changesets/git";
import { PreState } from "@changesets/types";
import * as logger from "@changesets/logger";
import { ExitError } from "@changesets/errors";

import pre from "./index";
import publish from "../publish";
import version from "../version";

let f = fixturez(__dirname);

let preStateForSimpleProject: PreState = {
  changesets: [],
  initialVersions: {
    "pkg-a": "1.0.0",
    "pkg-b": "1.0.0"
  },
  mode: "pre",
  tag: "next"
};

jest.mock("@changesets/logger");
jest.mock("@changesets/git");
jest.mock("../version");
jest.mock("../publish");

let mockedLogger = logger as jest.Mocked<typeof logger>;

describe("enterPre", () => {
  it("should enter", async () => {
    let cwd = f.copy("simple-project");
    await pre(cwd, { command: "enter", tag: "next" });

    expect(await fs.readJson(path.join(cwd, ".changeset", "pre.json"))).toEqual(
      preStateForSimpleProject
    );
    expect(mockedLogger.success).toBeCalledWith(
      `Entered pre mode with tag ${chalk.cyan("next")}`
    );
  });
  it("should throw if already in pre", async () => {
    let cwd = f.copy("simple-project");
    await fs.writeJSON(
      path.join(cwd, ".changeset", "pre.json"),
      preStateForSimpleProject
    );
    await expect(
      pre(cwd, { command: "enter", tag: "next" })
    ).rejects.toBeInstanceOf(ExitError);
    expect(mockedLogger.error).toBeCalledWith(
      "`changeset pre enter` cannot be run when in pre mode"
    );
    expect(logger.info).toBeCalledWith(
      "If you're trying to exit pre mode, run `changeset pre exit`"
    );
  });
});

describe("exitPre", () => {
  it("should exit", async () => {
    let cwd = f.copy("simple-project");
    await fs.writeJSON(
      path.join(cwd, ".changeset", "pre.json"),
      preStateForSimpleProject
    );
    await pre(cwd, { command: "exit" });

    expect(await fs.readJson(path.join(cwd, ".changeset", "pre.json"))).toEqual(
      { ...preStateForSimpleProject, mode: "exit" }
    );
  });
  it("should throw if not in pre", async () => {
    let cwd = f.copy("simple-project");
    await expect(pre(cwd, { command: "exit" })).rejects.toBeInstanceOf(
      ExitError
    );
    expect(mockedLogger.error).toBeCalledWith(
      "`changeset pre exit` can only be run when in pre mode"
    );
    expect(logger.info).toBeCalledWith(
      "If you're trying to enter pre mode, run `changeset pre enter`"
    );
  });
});

describe("snapshot release", () => {
  it("should throw if repository is not a git repository", async () => {
    // Return false for git error
    // @ts-ignore
    git.getLastCommitHash.mockImplementation(() => false);
    let cwd = f.copy("simple-project");
    await expect(
      pre(cwd, { command: "snapshot", tag: "exprimental" })
    ).rejects.toBeInstanceOf(ExitError);
  });
  it("should call version command config with commit false and release info - tag and commit hash", async () => {
    // @ts-ignore
    git.getLastCommitHash.mockImplementation(() => "7b8a4h");
    let cwd = f.copy("simple-project");
    await pre(cwd, { command: "snapshot", tag: "exprimental" });
    expect(version).toHaveBeenCalledWith(
      cwd,
      expect.objectContaining({
        commit: false
      }),
      expect.objectContaining({
        tag: "exprimental",
        commitHash: "7b8a4h"
      })
    );
  });
  it("should call publish command with updated config and options", async () => {
    // @ts-ignore
    git.getLastCommitHash.mockImplementation(() => "7b8a4h");
    let cwd = f.copy("simple-project");
    await pre(cwd, { command: "snapshot", tag: "exprimental", otp: "1234" });
    expect(publish).toHaveBeenCalledWith(
      cwd,
      expect.objectContaining({
        otp: "1234",
        tag: "exprimental"
      }),
      expect.objectContaining({
        commit: false
      })
    );
  });
});
