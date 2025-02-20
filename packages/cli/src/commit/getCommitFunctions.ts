import type { CommitFunctions } from "@changesets/types";
import path from "path";
import { resolve } from "import-meta-resolve";
import { pathToFileURL } from "node:url";

export async function getCommitFunctions(
  commit: false | readonly [string, any],
  cwd: string
): Promise<[CommitFunctions, any]> {
  let commitFunctions: CommitFunctions = {};
  if (!commit) {
    return [commitFunctions, null];
  }
  let commitOpts: any = commit[1];
  let changesetPath = path.join(cwd, ".changeset");
  let commitPath = resolve(commit[0], pathToFileURL(changesetPath).toString());

  let possibleCommitFunc = await import(commitPath);
  if (possibleCommitFunc.default) {
    possibleCommitFunc = possibleCommitFunc.default;
  }
  if (
    typeof possibleCommitFunc.getAddMessage === "function" ||
    typeof possibleCommitFunc.getVersionMessage === "function"
  ) {
    commitFunctions = possibleCommitFunc;
  } else {
    throw new Error("Could not resolve commit generation functions");
  }
  return [commitFunctions, commitOpts];
}
