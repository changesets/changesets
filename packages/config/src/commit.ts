import { Changeset, CommitFunctions, ReleasePlan } from "@changesets/types";
import path from "path";
import resolveFrom from "resolve-from";
import outdent from "outdent";

const getAddLine = async (changeset: Changeset) => {
  return `docs(changeset): ${changeset.summary}`;
};

const getVersionLine = async (releasePlan: ReleasePlan) => {
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
  getAddLine,
  getVersionLine
};

export function getCommitFuncs(
  commit: true | readonly [string, any],
  cwd: string
): [CommitFunctions, any] {
  if (commit === true) {
    return [defaultCommitFunctions, null];
  }

  let getCommitFuncs: CommitFunctions = {
    getAddLine: () => Promise.resolve(""),
    getVersionLine: () => Promise.resolve("")
  };
  let commitOpts: any = commit[1];
  let changesetPath = path.join(cwd, ".changeset");
  let commitPath = resolveFrom(changesetPath, commit[0]);

  let possibleCommitFunc = require(commitPath);
  if (possibleCommitFunc.default) {
    possibleCommitFunc = possibleCommitFunc.default;
  }
  if (
    typeof possibleCommitFunc.getAddLine === "function" &&
    typeof possibleCommitFunc.getVersionLine === "function"
  ) {
    getCommitFuncs = possibleCommitFunc;
  } else {
    throw new Error("Could not resolve commit generation functions");
  }
  return [getCommitFuncs, commitOpts];
}
