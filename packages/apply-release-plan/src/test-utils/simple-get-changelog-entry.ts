/* eslint-disable import/no-extraneous-dependencies */
import startCase from "lodash.startcase";
import {
  ComprehensiveRelease,
  VersionType,
  NewChangeset
} from "@changesets/types/src";
import { RelevantChangesets } from "../types";

async function getReleaseLine(changeset: NewChangeset) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  return `- ${firstLine}\n${futureLines.map(l => `  ${l}`).join("\n")}`;
}

async function getReleaseLines(obj: RelevantChangesets, type: VersionType) {
  const releaseLines = obj[type].map(getReleaseLine);
  if (!releaseLines.length) return "";
  const resolvedLines = await Promise.all(releaseLines);

  return `### ${startCase(type)} Changes\n\n${resolvedLines.join("")}`;
}

export default async function defaultChangelogGetter(
  release: ComprehensiveRelease,
  relevantChangesets: RelevantChangesets
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
