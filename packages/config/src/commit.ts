import {
  Changeset,
  CommitOptions,
  Config,
  ReleasePlan,
  WrittenConfig
} from "@changesets/types";
import outdent from "outdent";

export function getNormalizedCommitOption(
  thing: WrittenConfig["commit"]
): Config["commit"] {
  if (thing === false || thing === undefined) {
    return {
      add: false,
      version: false
    };
  }
  if (thing === true) {
    // default is commit for both but add "[skip ci]" only for version
    return {
      add: {
        skipCI: false
      },
      version: {
        skipCI: true
      }
    };
  }

  return {
    add: thing.add
      ? {
          skipCI:
            typeof thing.add === "boolean" ? false : thing.add.skipCI ?? false
        }
      : false,
    version: thing.version
      ? {
          skipCI:
            typeof thing.version === "boolean"
              ? true
              : thing.version.skipCI ?? true
        }
      : false
  };
}

export const getAddLine = (changeset: Changeset, commitOpts: CommitOptions) => {
  return outdent`docs(changeset): ${changeset.summary}${
    commitOpts.skipCI ? `\n\n[skip ci]\n` : ""
  }`;
};

export const getVersionLine = (
  releasePlan: ReleasePlan,
  commitOpts: CommitOptions
) => {
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
    ${commitOpts.skipCI ? `\n[skip ci]\n` : ""}
`;
};
