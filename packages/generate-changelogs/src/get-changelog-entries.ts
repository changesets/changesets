import getChangelogEntry from "./get-changelog-entry";
import {
  ChangelogFunctions,
  NewChangesetWithCommit,
  ComprehensiveRelease
} from "@changesets/types";
import { Packages } from "@manypkg/get-packages";

export default async function addChangelogEntries(
  releases: ComprehensiveRelease[],
  changesets: NewChangesetWithCommit[],
  packages: Packages,
  changelogFuncs: ChangelogFunctions,
  changelogOpts: any
): Promise<Map<string, string>> {
  let packagesByName = new Map(
    packages.packages.map(x => [x.packageJson.name, x])
  );

  let releaseWithPackages = releases.map(release => {
    let pkg = packagesByName.get(release.name);
    if (!pkg)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`
      );
    return {
      ...release,
      ...pkg
    };
  });

  let changelogEntries: Map<string, string> = new Map();

  for (let release of releaseWithPackages) {
    let changelog = await getChangelogEntry(
      release,
      releaseWithPackages,
      changesets,
      packages,
      changelogFuncs,
      changelogOpts
    );

    changelogEntries.set(release.name, changelog);
  }

  return changelogEntries;
}
