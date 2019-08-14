import {
  ComprehensiveRelease,
  NewChangeset,
  ChangelogFunction,
  PackageJSON
} from "@changesets/types";

import resolveFrom from "resolve-from";
import getDepdentsgraph from "get-dependents-graph";

import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

import { RelevantChangesets } from "./types";
type ModCompWithWorkspace = ComprehensiveRelease & {
  config: PackageJSON;
  dir: string;
};

export async function getNewChangelogEntry(
  releaseWithWorkspaces: ModCompWithWorkspace[],
  changesets: NewChangeset[],
  changelogConfig: false | readonly [string, any],
  cwd: string
) {
  let dependentsGraph = await getDepdentsgraph({ cwd });

  let getChangelogFunc: ChangelogFunction = () => Promise.resolve("");
  let changelogOpts: any;
  if (changelogConfig) {
    let changesetPath = path.join(cwd, ".changeset");
    let changelogPath = resolveFrom(changesetPath, changelogConfig[0]);

    let possibleChangelogFunc = require(changelogPath);
    if (typeof possibleChangelogFunc === "function") {
      getChangelogFunc = possibleChangelogFunc;
    } else if (typeof possibleChangelogFunc.default === "function") {
      getChangelogFunc = possibleChangelogFunc.default;
    } else {
      throw new Error("Could not resolve changelog generation function");
    }
  }

  return Promise.all(
    releaseWithWorkspaces.map(async release => {
      let relevantChangesets: RelevantChangesets = {
        major: [],
        minor: [],
        patch: []
      };

      for (let changeset of changesets) {
        if (release.changesets.includes(changeset.id)) {
          let csRelease = changeset.releases.find(
            rel => rel.name === release.name
          )!;
          relevantChangesets[csRelease.type].push(changeset);
        }
      }

      let thisDependentsGraph = dependentsGraph.get(release.name)!;

      const dependents = releaseWithWorkspaces.filter(release =>
        thisDependentsGraph.includes(release.name)
      );

      let changelog = await getChangelogFunc(
        release,
        relevantChangesets,
        dependents,
        { cwd, ...changelogOpts },
        releaseWithWorkspaces,
        changesets
      );
      return {
        ...release,
        changelog
      };
    })
  );
}

export async function updateChangelog(
  changelogPath: string,
  changelog: string,
  name: string,
  prettierConfig: prettier.Options | null
) {
  let templateString = `\n\n${changelog.trim()}\n`;

  try {
    if (fs.existsSync(changelogPath)) {
      await prependFile(changelogPath, templateString, name, prettierConfig);
    } else {
      await fs.writeFile(changelogPath, `# ${name}${templateString}`);
    }
  } catch (e) {
    console.warn(e);
  }
}

async function prependFile(
  filePath: string,
  data: string,
  name: string,
  prettierConfig?: prettier.Options | null
) {
  const fileData = fs.readFileSync(filePath).toString();
  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${name}${data}`;
    fs.writeFileSync(
      filePath,
      prettier.format(completelyNewChangelog, {
        ...prettierConfig,
        parser: "markdown"
      })
    );
    return;
  }
  const newChangelog = fileData.replace("\n", data);

  fs.writeFileSync(
    filePath,
    prettier.format(newChangelog, { ...prettierConfig, parser: "markdown" })
  );
}
