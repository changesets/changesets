import startCase from "lodash.startcase";

async function getReleaseLine(changeset) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  return `- ${firstLine}\n${futureLines.map(l => `  ${l}`).join("\n")}`;
}

async function getReleaseLines(obj, type) {
  const releaseLines = obj[type].map(getReleaseLine);
  if (!releaseLines.length) return "";
  const resolvedLines = await Promise.all(releaseLines);

  return `### ${startCase(type)} Changes\n\n${resolvedLines.join("")}`;
}

export default async function defaultChangelogGetter(
  release,
  relevantChangesets,
  options,
  allReleases,
  allChangesets
) {
  // First, we construct the release lines, summaries of changesets that caused us to be released
  const majorReleaseLines = await getReleaseLines(relevantChangesets, "major");
  const minorReleaseLines = await getReleaseLines(relevantChangesets, "minor");
  const patchReleaseLines = await getReleaseLines(relevantChangesets, "patch");

  return [
    `## ${release.newVersion}`,
    majorReleaseLines,
    minorReleaseLines,
    patchReleaseLines
  ]
    .filter(line => line)
    .join("\n");
}
