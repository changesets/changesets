import {
  ChangelogFunctions,
  NewChangesetWithCommit,
  ModCompWithPackage
} from "@changesets/types";

import startCase from "lodash.startcase";
import { Packages } from "@manypkg/get-packages";

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
export default async function getChangelogEntry(
  release: ModCompWithPackage,
  releases: ModCompWithPackage[],
  changesets: NewChangesetWithCommit[],
  packages: Packages,
  changelogFuncs: ChangelogFunctions,
  changelogOpts: any
): Promise<string> {
  if (release.type === "none") return "";

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
    let foundPackage = packages.packages.find(
      ({ packageJson }) => packageJson.name === release.name
    );

    if (!foundPackage)
      throw new Error(
        `Trouble assembling changelog - there was a release for a package that does not exist: ${release.name}`
      );

    let { packageJson } = foundPackage;

    return (
      (packageJson.dependencies && packageJson.dependencies[rel.name]) ||
      (packageJson.peerDependencies && packageJson.peerDependencies[rel.name])
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
