import outdent from "outdent";

// This data is not depended upon by the publish step, but can be useful for other tools/debugging
// I believe it would be safe to deprecate this format
export default function createReleaseCommit(releaseObj, skipCi) {
  const numPackagesReleased = releaseObj.releases.length;

  const cleanReleaseObj = {};
  cleanReleaseObj.releases = releaseObj.releases;
  cleanReleaseObj.changesets = releaseObj.changesets.map(changeset => ({
    commit: changeset.commit,
    summary: changeset.summary
  }));

  const releasesLines = releaseObj.releases
    .map(release => `  ${release.name}@${release.version}`)
    .join("\n");
  const dependentsLines =
    releaseObj.releases
      .filter(
        release => release.dependencies && release.dependencies.length > 0
      )
      .map(release => `  ${release.name}@${release.version}`)
      .join("\n") || "[]";
  const deletedLines =
    releaseObj.deleted.map(deleted => `  ${deleted.name}`).join("\n") || "  []";

  return outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}

    Dependents:
      ${dependentsLines}

    Deleted:
    ${deletedLines}
    ${skipCi ? "\n\n[skip ci]" : ""}
`;
}
