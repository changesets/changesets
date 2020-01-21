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
    let contents = await fs.readFile(preStatePath, "utf8");
    try {
      preState = JSON.parse(contents);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error("error parsing json:", contents);
      }
      throw err;
    }
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
    tools: ["yarn", "bolt", "pnpm", "root"]
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
    initialVersions: {},
    changesets: []
  };
  for (let workspace of workspaces) {
    newPreState.initialVersions[workspace.name] = workspace.config.version;
  }
  await fs.writeFile(preStatePath, JSON.stringify(newPreState, null, 2) + "\n");
}
