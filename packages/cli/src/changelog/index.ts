import {
  NewChangesetWithCommit,
  VersionType,
  ChangelogFunctions,
  ModCompWithWorkspace
} from "@changesets/types";

const getReleaseLine = async (
  changeset: NewChangesetWithCommit,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type: VersionType
) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  return `- ${changeset.commit}: ${firstLine}\n${futureLines
    .map(l => `  ${l}`)
    .join("\n")}`;
};

const getDependencyReleaseLine = async (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithWorkspace[]
) => {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    changeset => `- Updated dependencies [${changeset.commit}]:`
  );

  const updatedDepenenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [...changesetLinks, ...updatedDepenenciesList].join("\n");
};

const defaultChangelogFunctions: ChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine
};

export default defaultChangelogFunctions;
