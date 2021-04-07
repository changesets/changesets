import outdent from "outdent";
import { ReleasePlan } from "@changesets/types";
import * as git from "@changesets/git";

// This data is not depended upon by the publish step, but can be useful for other tools/debugging
// I believe it would be safe to deprecate this format
export default function createReleaseCommit(
  releasePlan: ReleasePlan,
  cwd: string
): Promise<boolean> {
  const publishableReleases = releasePlan.releases.filter(
    release => release.type !== "none"
  );
  const numPackagesReleased = publishableReleases.length;

  const releasesLines = publishableReleases
    .map(release => `  ${release.name}@${release.newVersion}`)
    .join("\n");

  const commitMsg = outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}

    [skip ci]
`;

  return git.commit(commitMsg, cwd);
}
