import yaml from "js-yaml";
import { Release, VersionType } from "@changesets/types";

const mdRegex = /\s*---([^]*?)\n\s*---\n([^]*)/;

export default function parseChangesetFile(
  contents: string
):
  | {
      summary: string;
      releases: Release[];
    }
  | {
      summary: string;
      name: string;
    } {
  const execResult = mdRegex.exec(contents);
  if (!execResult) {
    throw new Error(
      `could not parse changeset - invalid frontmatter: ${contents}`
    );
  }
  let [, roughReleases, roughSummary] = execResult;
  let summary = roughSummary.trim();
  let name: string;

  let releases: Release[];
  try {
    const yamlStuff: { [key: string]: VersionType } = yaml.safeLoad(
      roughReleases
    );
    if (yamlStuff) {
      releases = Object.entries(yamlStuff).map(([name, type]) => ({
        name,
        type
      }));
    } else {
      releases = [];
    }
  } catch (e) {
    throw new Error(
      `could not parse changeset - invalid frontmatter: ${contents}`
    );
  }

  if (!releases) {
    throw new Error(`could not parse changeset - unknown error: ${contents}`);
  }

  let globalRelease = releases.find(
    ({ name }) => name === "@changesets/secret-global-release"
  );

  if (globalRelease) {
    // check there is only one release
    if (releases.length > 1) {
      throw new Error(
        `could not parse changeset - global release changeset included additional information: ${contents}`
      );
    }

    return { name: globalRelease.type, summary };
  } else {
    return { releases, summary };
  }
}
