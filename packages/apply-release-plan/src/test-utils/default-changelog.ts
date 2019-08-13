// NOTE: This is a copy of the changelog found in the `cli`
// presented here so we can avoid a circular dependency while testing
// This is not the canon default-changelog. Do not treat it as canon.

// The above statement is false until we release v2, as we needed it here first
import startCase from "lodash.startcase";

async function getReleaseLine(changeset) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  return `- ${changeset.commit}: ${firstLine}\n${futureLines
    .map(l => `  ${l}`)
    .join("\n")}`;
}

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    changeset => `- Updated dependencies [${changeset.commit}]:`
  );

  const updatedDepenenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.version}`
  );

  return [...changesetLinks, ...updatedDepenenciesList].join("\n");
};

export default async function defaultChangelogGetter(
  release,
  relevantChangesets,
  options,
  allReleases,
  allChangesets
) {
  // First, we construct the release lines, summaries of changesets that caused us to be released
  const majorReleaseLines = await Promise.all(
    relevantChangesets["major"].map(cs => getReleaseLine(cs))
  );
  const minorReleaseLines = await Promise.all(
    relevantChangesets["minor"].map(cs => getReleaseLine(cs))
  );
  const patchReleaseLines = await Promise.all(
    relevantChangesets["patch"].map(cs => getReleaseLine(cs))
  );

  // TODO: We can't neatly calculate dependencies updated anymore
  // because they don't exist

  // const dependenciesUpdatedArr = [...dependenciesUpdated]
  //   .map(dependency => allReleases.find(r => r.name === dependency))
  //   // TODO: Figure out why we need to use the identity function here
  //   // In all cases, it should always be here
  //   .filter(r => r);

  // const dependencyReleaseLine = await getDependencyReleaseLine(
  //   dependentChangesets,
  //   dependenciesUpdatedArr
  // );

  return [
    `## ${release.newVersion}`,
    majorReleaseLines,
    minorReleaseLines,
    patchReleaseLines
    // dependencyReleaseLine
  ]
    .filter(line => line)
    .join("\n");
}
