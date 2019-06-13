import yaml from "js-yaml";

export default function parseChangesetFile(contents: string) {
  if (!contents.startsWith("---")) {
    throw new Error(
      `could not parse changeset - invalid frontmatter: ${contents}`
    );
  }
  let [, roughReleases, roughSummary] = contents.split("---");
  let summary = roughSummary.trim();

  let releases;
  try {
    releases = yaml.safeLoad(roughReleases);
  } catch (e) {
    throw new Error(
      `could not parse changeset - invalid frontmatter: ${contents}`
    );
  }

  if (!releases) {
    throw new Error(`could not parse changeset - unknown error: ${contents}`);
  }

  return { releases, summary };
}
