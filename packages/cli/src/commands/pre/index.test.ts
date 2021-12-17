import fixturez from "fixturez";
import path from "path";
import chalk from "chalk";
import * as fs from "fs-extra";
import { PreState } from "@changesets/types";
import * as logger from "@changesets/logger";
import { ExitError } from "@changesets/errors";

import pre from "./index";

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

let preStateForExited: PreState = {
  changesets: ["slimy-dingos-whisper"],
  initialVersions: {
    "pkg-a": "1.0.0",
    "pkg-b": "1.0.0"
  },
  mode: "exit",
  tag: "beta"
};

jest.mock("@changesets/logger");

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
  it("should enter if already exited pre mode", async () => {
    let cwd = f.copy("simple-project");
    await fs.writeJSON(
      path.join(cwd, ".changeset", "pre.json"),
      preStateForExited
    );
    await pre(cwd, { command: "enter", tag: "next" });
    expect(await fs.readJson(path.join(cwd, ".changeset", "pre.json"))).toEqual(
      {
        ...preStateForExited,
        mode: "pre",
        tag: "next"
      }
    );
    expect(mockedLogger.success).toBeCalledWith(
      `Entered pre mode with tag ${chalk.cyan("next")}`
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

    expect(
      await fs.readJson(path.join(cwd, ".changeset", "pre.json"))
    ).toEqual({ ...preStateForSimpleProject, mode: "exit" });
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
