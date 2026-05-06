import type {
  NewChangesetWithCommit,
  VersionType,
  ChangelogFunctions,
  ModCompWithPackage,
} from "@changesets/types";

const getReleaseLine = (
  changeset: NewChangesetWithCommit,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _type: VersionType,
): string => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimEnd());

  let returnVal = `- ${
    changeset.commit ? `${changeset.commit.slice(0, 7)}: ` : ""
  }${firstLine}`;

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  }

  return returnVal;
};

const getDependencyReleaseLine = (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[],
): string => {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    (changeset) =>
      `- Updated dependencies${
        changeset.commit ? ` [${changeset.commit.slice(0, 7)}]` : ""
      }`,
  );

  const updatedDependenciesList = dependenciesUpdated.map(
    (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
  );

  return [...changesetLinks, ...updatedDependenciesList].join("\n");
};

const defaultChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine,
} satisfies ChangelogFunctions;

// ChangelogFunctions require a default export
export default defaultChangelogFunctions;
