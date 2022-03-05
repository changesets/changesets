import { Changeset, CommitFunctions, ReleasePlan } from "@changesets/types";
import path from "path";
import resolveFrom from "resolve-from";
import outdent from "outdent";

const getAddMessage = async (changeset: Changeset) => {
  return `docs(changeset): ${changeset.summary}`;
};

const getVersionMessage = async (releasePlan: ReleasePlan) => {
  const publishableReleases = releasePlan.releases.filter(
    release => release.type !== "none"
  );
  const numPackagesReleased = publishableReleases.length;

  const releasesLines = publishableReleases
    .map(release => `  ${release.name}@${release.newVersion}`)
    .join("\n");

  return outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}

    [skip ci]

`;
};

export const defaultCommitFunctions: CommitFunctions = {
  getAddMessage,
  getVersionMessage
};

export default defaultCommitFunctions;

export function getCommitFuncs(
  commit: true | readonly [string, any],
  cwd: string
): [CommitFunctions, any] {
  if (commit === true) {
    return [defaultCommitFunctions, null];
  }

  let getCommitFuncs: CommitFunctions = {
    getAddMessage: () => Promise.resolve(""),
    getVersionMessage: () => Promise.resolve("")
  };
  let commitOpts: any = commit[1];
  let changesetPath = path.join(cwd, ".changeset");
  let commitPath = resolveFrom(changesetPath, commit[0]);

  let possibleCommitFunc = require(commitPath);
  if (possibleCommitFunc.default) {
    possibleCommitFunc = possibleCommitFunc.default;
  }
  if (
    typeof possibleCommitFunc.getAddMessage === "function" &&
    typeof possibleCommitFunc.getVersionMessage === "function"
  ) {
    getCommitFuncs = possibleCommitFunc;
  } else {
    throw new Error("Could not resolve commit generation functions");
  }
  return [getCommitFuncs, commitOpts];
}
