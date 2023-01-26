import {
  Changeset,
  CommitFunctions,
  ComprehensiveRelease,
  ReleasePlan,
} from "@changesets/types";
import outdent from "outdent";

type SkipCI = boolean | "add" | "version";

const getAddMessage: CommitFunctions["getAddMessage"] = async (
  changeset: Changeset,
  options: { skipCI?: SkipCI } | null
) => {
  const skipCI = options?.skipCI === "add" || options?.skipCI === true;
  return outdent`docs(changeset): ${changeset.summary}${
    skipCI ? `\n\n[skip ci]\n` : ""
  }`;
};

const getVersionMessage: CommitFunctions["getVersionMessage"] = async (
  releasePlan: ReleasePlan,
  options: { skipCI?: SkipCI } | null
) => {
  const skipCI = options?.skipCI === "version" || options?.skipCI === true;
  const publishableReleases = releasePlan.individualReleases.filter(
    (release) => release.type !== "none"
  );
  publishableReleases.concat(
    releasePlan.groupedReleases
      .flatMap<ComprehensiveRelease>((g) =>
        g.projects.map((p) => ({
          changesets: g.changesets,
          name: p.name,
          newVersion: g.newVersion,
          oldVersion: p.oldVersion,
          type: p.type,
        }))
      )
      .filter((release) => release.type !== "none")
  );

  const numPackagesReleased = publishableReleases.length;

  const releasesLines = publishableReleases
    .map((release) => `  ${release.name}@${release.newVersion}`)
    .join("\n");

  return outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}
    ${skipCI ? `\n[skip ci]\n` : ""}
`;
};

const defaultCommitFunctions: Required<CommitFunctions> = {
  getAddMessage,
  getVersionMessage,
};

export default defaultCommitFunctions;
