import {
  ReleasePlan,
  ChangelogFunctions,
  NewChangesetWithCommit,
  GlobalReleaseChangeset
} from "@changesets/types";
import getChangelogEntries from "@changesets/generate-changelogs";
import { Packages } from "@manypkg/get-packages";

const typeToLevel = {
  major: 3,
  minor: 2,
  patch: 1,
  none: 0
} as const;

function sortTheThings(
  a: { private: boolean; highestLevel: number },
  b: { private: boolean; highestLevel: number }
) {
  if (a.private === b.private) {
    return b.highestLevel - a.highestLevel;
  }
  if (a.private) {
    return 1;
  }
  return -1;
}

export default async function generateReleaseNotes(
  releasePlan: ReleasePlan,
  changesetWCommit: NewChangesetWithCommit[],
  packages: Packages,
  resolvedChangelogConfig: [ChangelogFunctions, any]
) {
  let { releases, globalReleaseChangeset } = releasePlan;

  if (!globalReleaseChangeset) {
    throw new Error(
      "For assembling release notes, you should have a release changeset: run `changeset add --release` to generate one"
    );
  }

  let changelogEntries = await getChangelogEntries(
    releases,
    changesetWCommit,
    packages,
    resolvedChangelogConfig[0],
    resolvedChangelogConfig[1]
  );

  return (
    getReleaseText(globalReleaseChangeset) +
    [...changelogEntries]
      .map(([name, entry]) => {
        let { type } = releases.find(r => r.name === name)!;
        let { packageJson } = packages.packages.find(
          pkg => pkg.packageJson.name === name
        )!;

        return {
          name,
          entry: modifyChangelogEntry(entry, name),
          highestLevel: typeToLevel[type],
          private: !!packageJson.private
        };
      })
      .filter(x => x)
      .sort(sortTheThings)
      .map(x => x.entry)
      .join("\n---\n\n")
  );
}

function getReleaseText({ name, summary }: GlobalReleaseChangeset) {
  return `${name.length > 0 ? `## ${name}\n\n` : ``}${
    summary.trim().length > 0 ? `${summary}\n\n` : ""
  }`;
}

function modifyChangelogEntry(entry: string, name: string) {
  return entry
    .replace("## ", `### ${name}@`)
    .replace("### Major Changes", `#### Major Changes`)
    .replace("### Minor Changes", `#### Minor Changes`)
    .replace("### Patch Changes", `#### Patch Changes`);
}
