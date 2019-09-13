// This custom config comes from atlaskit
const getLinkMD = commit =>
  `[${commit}](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/${commit})`;

const getReleaseLine = async (changeset, versionType) => {
  const indentedSummary = changeset.summary
    .split("\n")
    .map(l => `  ${l}`.trimRight())
    .join("\n");

  return `- [${versionType}] ${getLinkMD(
    changeset.commit
  )}:\n\n${indentedSummary}`;
};

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    changeset => `- Updated dependencies ${getLinkMD(changeset.commit)}:`
  );

  const updatedDepenenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [...changesetLinks, ...updatedDepenenciesList].join("\n");
};

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine
};
