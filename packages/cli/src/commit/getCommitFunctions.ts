import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CommitFunctions, Config } from "@changesets/types";
import { resolve } from "import-meta-resolve";

function importResolveFromDir(specifier: string, dir: string) {
  return resolve(specifier, pathToFileURL(path.join(dir, "x.mjs")).toString());
}

export async function getCommitFunctions(
  commit: Config["commit"],
  cwd: string,
  contextDir: string,
): Promise<[CommitFunctions, null | Record<string, unknown>]> {
  let commitFunctions: CommitFunctions = {};
  if (!commit) {
    return [commitFunctions, null];
  }
  const commitOpts = commit[1];
  const changesetPath = path.join(cwd, ".changeset");
  let commitPath;

  try {
    commitPath = importResolveFromDir(commit[0], changesetPath);
  } catch {
    commitPath = importResolveFromDir(commit[0], contextDir);
  }

  let possibleCommitFunc = await import(commitPath);
  if (possibleCommitFunc.default) {
    possibleCommitFunc = possibleCommitFunc.default;

    // Check nested default again in case it's CJS with `__esModule` interop
    if (possibleCommitFunc.default) {
      possibleCommitFunc = possibleCommitFunc.default;
    }
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
