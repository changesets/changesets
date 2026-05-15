import type { CommitFunctions } from "@changesets/types";

type SkipCI = boolean | "add" | "version";

const commitFunctions: Required<CommitFunctions> = {
  getAddMessage: (changeset, options: { skipCI?: SkipCI } | null) => {
    const skipCI = options?.skipCI === "add" || options?.skipCI === true;
    const skipMsg = skipCI ? `\n\n[skip ci]\n` : "";
    return `docs(changeset): ${changeset.summary}${skipMsg}`;
  },
  getVersionMessage: (releasePlan, options: { skipCI?: SkipCI } | null) => {
    const skipCI = options?.skipCI === "version" || options?.skipCI === true;
    const publishableReleases = releasePlan.releases.filter(
      (release) => release.type !== "none",
    );
    const numPackagesReleased = publishableReleases.length;

    const releasesLines = publishableReleases
      .map((release) => `  ${release.name}@${release.newVersion}`)
      .join("\n");

    return `RELEASING: Releasing ${numPackagesReleased} package(s)

Releases:
${releasesLines}
${skipCI ? `\n[skip ci]\n` : ""}`;
  },
};

// CommitFunctions require a default export
export default commitFunctions;
