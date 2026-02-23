import yaml from "js-yaml";
import { Release, VersionType } from "@changesets/types";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

function validateReleases(releases: Release[], contents: string): void {
  const validVersionTypes: readonly VersionType[] = [
    "major",
    "minor",
    "patch",
    "none",
  ];

  for (const release of releases) {
    if (typeof release.name !== "string" || release.name.trim() === "") {
      throw new Error(
        `could not parse changeset - invalid package name in frontmatter.\n` +
          `Expected a non-empty string for package name, but got: ${JSON.stringify(
            release.name
          )}\n` +
          `Make sure your changeset frontmatter follows this format:\n` +
          `---\n"package-name": patch\n---`
      );
    }

    if (typeof release.type !== "string") {
      throw new Error(
        `could not parse changeset - invalid usage of release type in frontmatter.\n` +
          `Expected a string for release type, but got: ${typeof release.type}\n` +
          `Make sure your changeset frontmatter follows this format:\n` +
          `---\n"package-name": patch\n---`
      );
    }

    if (!validVersionTypes.includes(release.type)) {
      throw new Error(
        `could not parse changeset - invalid version type ${JSON.stringify(
          release.type
        )} for package "${release.name}".\n` +
          `Valid version types are: ${validVersionTypes.join(", ")}\n` +
          `Changeset contents:\n${contents.slice(0, 200)}${
            contents.length > 200 ? "..." : ""
          }`
      );
    }
  }
}

export default function parseChangesetFile(contents: string): {
  summary: string;
  releases: Release[];
} {
  const trimmedContents = contents.trim();

  if (!trimmedContents) {
    throw new Error(
      `could not parse changeset - file is empty.\n` +
        `Changesets must have frontmatter with package names and version types.\n` +
        `Example:\n---\n"package-name": patch\n---\n\nYour changeset summary here.`
    );
  }

  const execResult = mdRegex.exec(contents);
  if (!execResult) {
    throw new Error(
      `could not parse changeset - missing or invalid frontmatter.\n` +
        `Changesets must start with frontmatter delimited by "---".\n` +
        `Example:\n---\n"package-name": patch\n---\n\nYour changeset summary here.\n` +
        `Received content:\n${trimmedContents.slice(0, 200)}${
          trimmedContents.length > 200 ? "..." : ""
        }`
    );
  }
  let [, roughReleases, roughSummary] = execResult;
  let summary = roughSummary.trim();

  let releases: Release[];
  let yamlStuff: Record<string, VersionType> | undefined;
  try {
    yamlStuff = yaml.load(roughReleases) as typeof yamlStuff;
  } catch (e) {
    throw new Error(
      `could not parse changeset - invalid YAML in frontmatter.\n` +
        `The frontmatter between the "---" delimiters must be valid YAML.\n` +
        `YAML error: ${e instanceof Error ? e.message : String(e)}\n` +
        `Frontmatter content:\n${roughReleases}`
    );
  }

  if (yamlStuff) {
    if (typeof yamlStuff !== "object" || Array.isArray(yamlStuff)) {
      throw new Error(
        `could not parse changeset - frontmatter must be an object mapping package names to version types.\n` +
          `Expected format:\n---\n"package-name": patch\n---\n` +
          `Received:\n${roughReleases}`
      );
    }

    releases = Object.entries(yamlStuff).map(([name, type]) => ({
      name,
      type,
    }));
  } else {
    releases = [];
  }

  validateReleases(releases, contents);

  return { releases, summary };
}
