import startCase from "lodash.startcase";

import {
  ChangelogFunctions,
  NewChangesetWithCommit,
  VersionType
} from "@changesets/types";

import { ModCompWithWorkspace } from "@changesets/types";

type ChangelogLines = {
  major: Array<Promise<string>>;
  minor: Array<Promise<string>>;
  patch: Array<Promise<string>>;
};

async function smallHelper(obj: ChangelogLines, type: VersionType) {
  const releaseLines = obj[type];
  if (!releaseLines.length) return "";
  const resolvedLines = await Promise.all(releaseLines);

  return `### ${startCase(type)} Changes\n\n${resolvedLines.join("")}`;
}

// release is the package and version we are releasing
export default async function generateMarkdown(
  release: ModCompWithWorkspace,
  releases: ModCompWithWorkspace[],
  changesets: NewChangesetWithCommit[],
  changelogFuncs: ChangelogFunctions,
  changelogOpts: any
) {
  const releaseObj: ChangelogLines = {
    major: [],
    minor: [],
    patch: []
  };

  // I sort of feel we can do better, as ComprehensiveReleases have an array
  // of the relevant changesets but since we need the version type for the
  // release in the changeset, I don't know if we can
  // We can filter here, but that just adds another iteration over this list
  changesets.forEach(cs => {
    const rls = cs.releases.find(r => r.name === release.name);
    if (rls) {
      releaseObj[rls.type].push(
        changelogFuncs.getReleaseLine(cs, rls.type, changelogOpts)
      );
    }
  });

  // First, we construct the release lines, summaries of changesets that caused us to be released
  const majorReleaseLines = await smallHelper(releaseObj, "major");
  const minorReleaseLines = await smallHelper(releaseObj, "minor");
  const patchReleaseLines = await smallHelper(releaseObj, "patch");

  let dependentReleases = releases.filter(rel => {
    return (
      (release.config.dependencies && release.config.dependencies[rel.name]) ||
      (release.config.devDependencies &&
        release.config.devDependencies[rel.name]) ||
      (release.config.peerDependencies &&
        release.config.peerDependencies[rel.name])
    );
  });

  let relevantChangesetIds: Set<string> = new Set();

  dependentReleases.forEach(rel => {
    rel.changesets.forEach(cs => {
      relevantChangesetIds.add(cs);
    });
  });

  let relevantChangesets = changesets.filter(cs =>
    relevantChangesetIds.has(cs.id)
  );

  const dependencyReleaseLine = await changelogFuncs.getDependencyReleaseLine(
    relevantChangesets,
    dependentReleases,
    changelogOpts
  );

  return [
    `## ${release.newVersion}`,
    majorReleaseLines,
    minorReleaseLines,
    patchReleaseLines,
    dependencyReleaseLine
  ]
    .filter(line => line)
    .join("\n");
}
