import type { CommitFunctions } from "@changesets/types";
import path from "path";
import { resolve } from "import-meta-resolve";
import { pathToFileURL } from "node:url";

function importResolveFromDir(specifier: string, dir: string) {
  return resolve(specifier, pathToFileURL(path.join(dir, "x.mjs")).toString());
}

export async function getCommitFunctions(
  commit: false | readonly [string, any],
  cwd: string,
  contextDir: string
): Promise<[CommitFunctions, any]> {
  let commitFunctions: CommitFunctions = {};
  if (!commit) {
    return [commitFunctions, null];
  }
  let commitOpts: any = commit[1];
  let changesetPath = path.join(cwd, ".changeset");
  let commitPath;

  try {
    commitPath = importResolveFromDir(commit[0], changesetPath);
  } catch {
    commitPath = importResolveFromDir(commit[0], contextDir);
  }

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
