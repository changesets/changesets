import { getCommitsThatAddFiles } from "@changesets/git";
import type { ComprehensiveRelease, NewChangeset } from "@changesets/types";
import type { RelevantChangesets } from "../types.ts";
import { capitalize } from "../utils.ts";

async function getReleaseLine(changeset: NewChangeset, cwd: string) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimEnd());

  const [commitThatAddsFile] = await getCommitsThatAddFiles(
    [`.changeset/${changeset.id}.md`],
    { cwd },
  );

  return `- [${commitThatAddsFile}] ${firstLine}\n${futureLines
    .map((l) => `  ${l}`)
    .join("\n")}`;
}

async function getReleaseLines(
  obj: RelevantChangesets,
  type: keyof RelevantChangesets,
  cwd: string,
) {
  const releaseLines = obj[type].map((changeset) =>
    getReleaseLine(changeset, cwd),
  );
  if (!releaseLines.length) return "";
  const resolvedLines = await Promise.all(releaseLines);

  return `### ${capitalize(type)} Changes\n\n${resolvedLines.join("")}`;
}

// plugin, needs default export
// eslint-disable-next-line import-lite/no-default-export
export default async function defaultChangelogGetter(
  release: ComprehensiveRelease,
  relevantChangesets: RelevantChangesets,
  options: { cwd: string },
) {
  const { cwd } = options;

  // First, we construct the release lines, summaries of changesets that caused us to be released
  const majorReleaseLines = await getReleaseLines(
    relevantChangesets,
    "major",
    cwd,
  );
  const minorReleaseLines = await getReleaseLines(
    relevantChangesets,
    "minor",
    cwd,
  );
  const patchReleaseLines = await getReleaseLines(
    relevantChangesets,
    "patch",
    cwd,
  );

  return [
    `## ${release.newVersion}\n`,
    majorReleaseLines,
    minorReleaseLines,
    patchReleaseLines,
  ]
    .filter((line) => line)
    .join("\n");
}
