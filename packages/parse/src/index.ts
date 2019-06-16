import yaml from "js-yaml";
import { Release } from "@changesets/types";

export default function parseChangesetFile(
  contents: string
): {
  summary: string;
  releases: Release[];
} {
  if (!contents.startsWith("---")) {
    throw new Error(
      `could not parse changeset - invalid frontmatter: ${contents}`
    );
  }
  let [, roughReleases, roughSummary] = contents.split("---");
  let summary = roughSummary.trim();

  let releases: Release[];
  try {
    const yamlStuff = yaml.safeLoad(roughReleases);
    releases = Object.entries(yamlStuff).map(([name, type]) => ({
      name,
      type
    }));
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
