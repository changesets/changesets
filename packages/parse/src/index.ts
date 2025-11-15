import { Release, VersionType } from "@changesets/types";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

// Parse simple YAML-like syntax:
// "pkg": minor
// pkg: patch
// Allow the version (major|minor|patch|none) to be quoted or unquoted.
const versionRegex =
  /^(?:"([^"]+)"|'([^']+)'|([^:\s]+))\s*:\s*(?:"|')?(major|minor|patch|none)(?:"|')?$/;

export default function parseChangesetFile(contents: string): {
  summary: string;
  releases: Release[];
} {
  const execResult = mdRegex.exec(contents);
  if (!execResult) {
    throw new Error(
      `could not parse changeset - invalid frontmatter: ${contents}`
    );
  }

  let [, frontmatter, roughSummary] = execResult;
  const summary = roughSummary.trim();

  const lines = frontmatter
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const releases: Release[] = [];

  for (const line of lines) {
    const m = versionRegex.exec(line);

    if (!m) {
      throw new Error(
        `could not parse changeset - invalid frontmatter line: ${line}`
      );
    }

    const name = m[1] ?? m[2] ?? m[3];
    const type = m[4] as VersionType;

    releases.push({ name, type });
  }

  return { releases, summary };
}
