import * as fs from "fs-extra";
import path from "path";
import { PreState } from "@changesets/types";
import getWorkspaces from "get-workspaces";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError
} from "@changesets/errors";

export async function readPreState(cwd: string) {
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState: PreState | undefined;
  try {
    preState = await fs.readJson(preStatePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  return preState;
}

export async function exitPre(cwd: string) {
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState = await readPreState(cwd);

  if (preState === undefined) {
    throw new PreExitButNotInPreModeError();
  }

  await fs.writeFile(
    preStatePath,
    JSON.stringify({ ...preState, mode: "exit" }, null, 2) + "\n"
  );
}

export async function enterPre(cwd: string, tag: string) {
  let workspaces = (await getWorkspaces({
    cwd,
    tools: ["bolt", "root", "yarn"]
  }))!;
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState = await readPreState(cwd);
  if (preState !== undefined) {
    throw new PreEnterButInPreModeError();
  }
  let newPreState: PreState = {
    mode: "pre",
    tag,
    packages: {},
    version: -1
  };
  for (let workspace of workspaces) {
    newPreState.packages[workspace.name] = {
      initialVersion: workspace.config.version,
      highestVersionType: null,
      releaseLines: {
        major: [],
        minor: [],
        patch: []
      }
    };
  }
  await fs.writeFile(preStatePath, JSON.stringify(newPreState, null, 2) + "\n");
}
