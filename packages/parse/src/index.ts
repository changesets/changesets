import type { Changeset } from "@changesets/types";
import { safeParse } from "valibot";
import * as yaml from "yaml";
import { FrontMatterSchema } from "./frontmatter.ts";

const mdRegex = /\s*---([^]*?)\r?\n\s*---(\s*(?:\n|$)[^]*)/;

const EXAMPLE_FORMAT = `---\n"package-name": patch\n---`;

function truncate(s: string, max = 200): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

export function parseChangesetFile(contents: string): Changeset {
  const trimmedContents = contents.trim();

  if (trimmedContents.length === 0) {
    throw new Error(
      `Could not parse changeset: file is empty.\n` +
        `Changesets must have frontmatter with package names and version types.\n` +
        `Example:\n${EXAMPLE_FORMAT}\n\nYour changeset summary here.`,
    );
  }

  const execResult = mdRegex.exec(contents);
  if (execResult == null) {
    throw new Error(
      `Could not parse changeset: missing or invalid frontmatter.\n` +
        `Changesets must start with frontmatter delimited by "---".\n` +
        `Example:\n${EXAMPLE_FORMAT}\n\nYour changeset summary here.\n` +
        `Received content:\n${truncate(trimmedContents)}`,
    );
  }
  const [, roughReleases, roughSummary] = execResult;
  const summary = roughSummary.trim();

  let yamlStuff: unknown;
  try {
    yamlStuff = yaml.parse(roughReleases);
  } catch (e) {
    throw new Error(
      `Could not parse changeset: invalid YAML in frontmatter.\n` +
        `The frontmatter between the "---" delimiters must be valid YAML.\n` +
        `YAML error: ${e instanceof Error ? e.message : String(e)}\n` +
        `Frontmatter content:\n${roughReleases}`,
      { cause: e },
    );
  }

  const result = safeParse(FrontMatterSchema, yamlStuff);
  if (!result.success) {
    const issueLines = result.issues
      .map(
        (issue) =>
          `${issue.path?.map((p) => p.key)?.join(".") || "."}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(
      `Could not parse changeset:\n${issueLines}\n\nReceived:\n${contents}`,
    );
  }

  if (result.output == null) {
    return { releases: [], summary: summary ?? "" };
  }

  const { _: metadata, ...releasesByName } = result.output;
  const releases = Object.entries(releasesByName).map(([key, value]) => ({
    name: key,
    type: value,
  }));

  const changeset = {
    releases,
    summary,
  } satisfies Changeset as Changeset;
  if (metadata != null) {
    changeset.metadata = metadata;
  }

  return changeset;
}

/** @deprecated Use named export `parseChangesetFile` instead */
const parseChangesetFileDefault = parseChangesetFile;
export default parseChangesetFileDefault;
