import { ChangelogFunctions } from "@changesets/types";
import path from "path";
import resolveFrom from "resolve-from";

export default function resolveChangelogFuncs(
  changelogFuncPath: string,
  cwd: string
): ChangelogFunctions {
  let resolvedChangelogFuncs;

  let changesetPath = path.join(cwd, ".changeset");
  let changelogPath = resolveFrom(changesetPath, changelogFuncPath);

  let possibleChangelogFunc = require(changelogPath);
  if (possibleChangelogFunc.default) {
    possibleChangelogFunc = possibleChangelogFunc.default;
  }
  if (
    typeof possibleChangelogFunc.getReleaseLine === "function" &&
    typeof possibleChangelogFunc.getDependencyReleaseLine === "function"
  ) {
    resolvedChangelogFuncs = possibleChangelogFunc;
  } else {
    throw new Error("Could not resolve changelog generation functions");
  }

  return resolvedChangelogFuncs;
}
