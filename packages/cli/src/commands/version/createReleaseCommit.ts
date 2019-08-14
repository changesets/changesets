import outdent from "outdent";
import { ReleasePlan } from "@changesets/types/src";

// This data is not depended upon by the publish step, but can be useful for other tools/debugging
// I believe it would be safe to deprecate this format
export default function createReleaseCommit(
  releaseObj: ReleasePlan,
  commit: boolean
) {
  const numPackagesReleased = releaseObj.releases.length;

  const releasesLines = releaseObj.releases
    .map(release => `  ${release.name}@${release.newVersion}`)
    .join("\n");

  return outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}
    ${commit ? "\n\n[skip ci]" : ""}
`;
}
