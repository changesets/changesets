import {
  ChangelogFunctions,
  NewChangesetWithCommit,
  VersionType,
  PreState
} from "@changesets/types";

import { ModCompWithWorkspace } from "@changesets/types";

type ChangelogLines = {
  major: Array<Promise<string> | string>;
  minor: Array<Promise<string> | string>;
  patch: Array<Promise<string> | string>;
};

// release is the package and version we are releasing
export default async function generateMarkdown(
  release: ModCompWithWorkspace,
  releases: ModCompWithWorkspace[],
  changesets: NewChangesetWithCommit[],
  changelogFuncs: ChangelogFunctions,
  changelogOpts: any,
  preState: PreState | undefined
) {
  const releaseObj: ChangelogLines = {
    major: [],
    minor: [],
    patch: []
  };

  if (preState !== undefined && preState.mode === "exit") {
    let pkg = preState.packages[release.name];
    if (pkg) {
      releaseObj.major.push(...pkg.releaseLines.major);
      releaseObj.minor.push(...pkg.releaseLines.minor);
      releaseObj.patch.push(...pkg.releaseLines.patch);
    }
  }

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

  releaseObj.patch.push(
    changelogFuncs.getDependencyReleaseLine(
      relevantChangesets,
      dependentReleases,
      changelogOpts
    )
  );

  return {
    patch: (await Promise.all(releaseObj.patch)).filter(x => x),
    minor: (await Promise.all(releaseObj.minor)).filter(x => x),
    major: (await Promise.all(releaseObj.major)).filter(x => x)
  };
}
