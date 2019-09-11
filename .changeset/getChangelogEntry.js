require("dotenv").config();
const { getInfo } = require("@changesets/get-github-info");

const getReleaseLine = async (changeset, type) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  if (changeset.commit) {
    let { links } = await getInfo({
      repo: "atlassian/changesets",
      commit: changeset.commit
    });
    return `- ${links.commit}${links.pull === null ? "" : ` ${links.pull}`}${
      links.user === null ? "" : ` Thanks ${links.user}!`
    } - ${firstLine}\n${futureLines.map(l => `  ${l}`).join("\n")}`;
  } else {
    return `- ${firstLine}\n${futureLines.map(l => `  ${l}`).join("\n")}`;
  }
};

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";

  changesets.map(cs => cs.commit).filter(_ => _);

  const changesetLink = `- Updated dependencies [${changesets
    .map(cs => cs.commit)
    .filter(_ => _)
    .join(", ")}]:`;

  const updatedDepenenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [changesetLink, ...updatedDepenenciesList].join("\n");
};

module.exports = {
  getDependencyReleaseLine,
  getReleaseLine
};
