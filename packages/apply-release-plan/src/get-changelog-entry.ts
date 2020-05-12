import { ChangelogFunctions, NewChangesetWithCommit } from "@changesets/types";

import { ModCompWithPackage } from "@changesets/types";
import startCase from "lodash.startcase";
import { shouldUpdateInternalDependencies } from "./utils";

type ChangelogLines = {
  major: Array<Promise<string>>;
  minor: Array<Promise<string>>;
  patch: Array<Promise<string>>;
};

async function generateChangesForVersionTypeMarkdown(
  obj: ChangelogLines,
  type: keyof ChangelogLines
) {
  let releaseLines = await Promise.all(obj[type]);
  releaseLines = releaseLines.filter(x => x);
  if (releaseLines.length) {
    return `### ${startCase(type)} Changes\n\n${releaseLines.join("\n")}\n`;
  }
}

// release is the package and version we are releasing
export default async function generateMarkdown(
  release: ModCompWithPackage,
  releases: ModCompWithPackage[],
  changesets: NewChangesetWithCommit[],
  changelogFuncs: ChangelogFunctions,
  changelogOpts: any,
  updateInternalDependencies: "patch" | "minor"
) {
  if (release.type === "none") return null;

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
    if (rls && rls.type !== "none") {
      releaseObj[rls.type].push(
        changelogFuncs.getReleaseLine(cs, rls.type, changelogOpts)
      );
    }
  });

  let dependentReleases = releases.filter(rel => {
    const isDependency =
      release.packageJson.dependencies &&
      release.packageJson.dependencies[rel.name];
    const isPeerDependency =
      release.packageJson.peerDependencies &&
      release.packageJson.peerDependencies[rel.name];
    return (
      (isDependency || isPeerDependency) &&
      shouldUpdateInternalDependencies(updateInternalDependencies, rel.type)
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

  releaseObj.patch.push(
    changelogFuncs.getDependencyReleaseLine(
      relevantChangesets,
      dependentReleases,
      changelogOpts
    )
  );

  return [
    `## ${release.newVersion}`,
    await generateChangesForVersionTypeMarkdown(releaseObj, "major"),
    await generateChangesForVersionTypeMarkdown(releaseObj, "minor"),
    await generateChangesForVersionTypeMarkdown(releaseObj, "patch")
  ]
    .filter(line => line)
    .join("\n");
}
