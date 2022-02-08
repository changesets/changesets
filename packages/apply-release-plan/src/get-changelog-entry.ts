import { ChangelogFunctions, NewChangesetWithCommit } from "@changesets/types";

import { ModCompWithPackage, DependencyType } from "@changesets/types";
import startCase from "lodash.startcase";
import { shouldUpdateDependencyBasedOnConfig } from "./utils";

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

function getRelevantChangesets(
  releases: ModCompWithPackage[],
  changesets: NewChangesetWithCommit[]
) {
  let relevantChangesetIds: Set<string> = new Set();
  releases.forEach(rel => {
    rel.changesets.forEach(cs => {
      relevantChangesetIds.add(cs);
    });
  });

  return changesets.filter(cs => relevantChangesetIds.has(cs.id));
}

// release is the package and version we are releasing
export default async function getChangelogEntry(
  release: ModCompWithPackage,
  releases: ModCompWithPackage[],
  changesets: NewChangesetWithCommit[],
  changelogFuncs: ChangelogFunctions,
  changelogOpts: any,
  {
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange
  }: {
    updateInternalDependencies: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  }
) {
  if (release.type === "none") return null;

  const changelogLines: ChangelogLines = {
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
      changelogLines[rls.type].push(
        changelogFuncs.getReleaseLine(cs, rls.type, changelogOpts)
      );
    }
  });

  let dependentReleases: ModCompWithPackage[] = [];
  let peerDependentReleases: ModCompWithPackage[] = [];
  releases.forEach(rel => {
    const dependencyVersionRange = release.packageJson.dependencies?.[rel.name];
    const peerDependencyVersionRange =
      release.packageJson.peerDependencies?.[rel.name];
    const depType: DependencyType = peerDependencyVersionRange
      ? "peerDependencies"
      : "dependencies";
    const versionRange = peerDependencyVersionRange || dependencyVersionRange;

    const shouldUpdate =
      versionRange &&
      shouldUpdateDependencyBasedOnConfig(
        { type: rel.type, version: rel.newVersion },
        {
          depVersionRange: versionRange,
          depType
        },
        {
          minReleaseType: updateInternalDependencies,
          onlyUpdatePeerDependentsWhenOutOfRange
        }
      );

    if (!shouldUpdate) {
      return;
    }
    if (depType === "peerDependencies") {
      peerDependentReleases.push(rel);
    } else {
      dependentReleases.push(rel);
    }
  });

  changelogLines.major.push(
    changelogFuncs.getDependencyReleaseLine(
      getRelevantChangesets(peerDependentReleases, changesets),
      peerDependentReleases,
      changelogOpts,
      "peerDependencies"
    )
  );
  changelogLines.patch.push(
    changelogFuncs.getDependencyReleaseLine(
      getRelevantChangesets(dependentReleases, changesets),
      dependentReleases,
      changelogOpts,
      "dependencies"
    )
  );

  return [
    `## ${release.newVersion}`,
    await generateChangesForVersionTypeMarkdown(changelogLines, "major"),
    await generateChangesForVersionTypeMarkdown(changelogLines, "minor"),
    await generateChangesForVersionTypeMarkdown(changelogLines, "patch")
  ]
    .filter(line => line)
    .join("\n");
}
