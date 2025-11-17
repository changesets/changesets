import { Changeset, CommitFunctions, ReleasePlan } from "@changesets/types";

type SkipCI = boolean | "add" | "version";

const getAddMessage: CommitFunctions["getAddMessage"] = async (
  changeset: Changeset,
  options: { skipCI?: SkipCI } | null
) => {
  const skipCI = options?.skipCI === "add" || options?.skipCI === true;
  const skipMsg = skipCI ? `\n\n[skip ci]\n` : "";
  return `docs(changeset): ${changeset.summary}${skipMsg}`;
};

const getVersionMessage: CommitFunctions["getVersionMessage"] = async (
  releasePlan: ReleasePlan,
  options: { skipCI?: SkipCI } | null
) => {
  const skipCI = options?.skipCI === "version" || options?.skipCI === true;
  const publishableReleases = releasePlan.releases.filter(
    (release) => release.type !== "none"
  );
  const numPackagesReleased = publishableReleases.length;

  const releasesLines = publishableReleases
    .map((release) => `  ${release.name}@${release.newVersion}`)
    .join("\n");

  return `RELEASING: Releasing ${numPackagesReleased} package(s)

Releases:
${releasesLines}
${skipCI ? `\n[skip ci]\n` : ""}`;
};

const defaultCommitFunctions: Required<CommitFunctions> = {
  getAddMessage,
  getVersionMessage,
};

export default defaultCommitFunctions;
