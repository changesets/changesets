import startCase from "lodash.startcase";
import { getCommitThatAddsFile } from "@changesets/git";

async function getReleaseLine(changeset, cwd) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  const commitThatAddsFile = getCommitThatAddsFile();

  return `- ${firstLine}\n${futureLines.map(l => `  ${l}`).join("\n")}`;
}

async function getReleaseLines(obj, type, cwd) {
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
  let { cwd } = options;

  // First, we construct the release lines, summaries of changesets that caused us to be released
  let majorReleaseLines = await getReleaseLines(relevantChangesets, "major");
  let minorReleaseLines = await getReleaseLines(relevantChangesets, "minor");
  let patchReleaseLines = await getReleaseLines(relevantChangesets, "patch");

  return [
    `## ${release.newVersion}`,
    majorReleaseLines,
    minorReleaseLines,
    patchReleaseLines
  ]
    .filter(line => line)
    .join("\n");
}
