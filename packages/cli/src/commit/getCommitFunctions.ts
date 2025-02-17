import type { CommitFunctions } from "@changesets/types";
import path from "path";
import { resolve } from "import-meta-resolve";

export function getCommitFunctions(
  commit: false | readonly [string, any],
  cwd: string
): [CommitFunctions, any] {
  let commitFunctions: CommitFunctions = {};
  if (!commit) {
    return [commitFunctions, null];
  }
  let commitOpts: any = commit[1];
  let changesetPath = path.join(cwd, ".changeset");
  let commitPath = resolve(changesetPath, commit[0]);

  let possibleCommitFunc = require(commitPath);
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
