import {
  ReleasePlan,
  Config,
  ComprehensiveRelease,
  NewChangeset,
  ChangelogFunction
} from "@changesets/types";

import { defaultConfig } from "@changesets/config";

import getWorksaces, { PackageJSON } from "get-workspaces";
import resolveFrom from "resolve-from";

import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

import versionPackage from "./version-package";
import { RelevantChangesets } from "./types";

export default async function applyReleasePlan(
  releasePlan: ReleasePlan,
  cwd: string,
  config: Config = defaultConfig
) {
  let touchedFiles = [];
  let workspaces = await getWorksaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!workspaces) throw new Error(`could not find any workspaces in ${cwd}`);

  let { releases, changesets } = releasePlan;

  let releaseWithWorkspaces = releases.map(release => {
    // @ts-ignore we already threw if workspaces wasn't defined
    let workspace = workspaces.find(ws => ws.name === release.name);
    if (!workspace)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`
      );
    return { ...release, config: workspace.config, dir: workspace.dir };
  });

  // I think this might be the wrong place to do this, but gotta do it somewhere -  add changelog entries to releases
  let releaseWithChangelogs = await getNewChangelogEntry(
    releaseWithWorkspaces,
    changesets,
    config.changelog,
    cwd
  );

  let versionsToUpdate = releases.map(
    ({ name, newVersion }) => ({ name, version: newVersion }),
    {}
  );

  // iterate over releases updating packages
  let finalisedRelease = await Promise.all(
    releaseWithChangelogs.map(release => {
      return versionPackage(release, versionsToUpdate);
    })
  );

  let prettierConfig = await prettier.resolveConfig(cwd);

  for (let release of finalisedRelease) {
    let { changelog, config, dir, name } = release;
    let pkgJSONPath = path.resolve(dir, "package.json");

    let changelogPath = path.resolve(dir, "CHANGELOG.md");

    let parsedConfig = prettier.format(JSON.stringify(config), {
      ...prettierConfig,
      parser: "json"
    });

    await fs.writeFile(pkgJSONPath, parsedConfig);
    touchedFiles.push(pkgJSONPath);

    if (changelog && changelog.length > 0) {
      await updateChangelog(changelogPath, changelog, name, prettierConfig);
      touchedFiles.push(changelogPath);
    }
  }

  let changesetFolder = path.resolve(cwd, ".changeset");

  await Promise.all(
    changesets.map(changeset => {
      let changesetPath = path.resolve(changesetFolder, `${changeset.id}.md`);
      touchedFiles.push(changesetPath);
      return fs.remove(changesetPath);
    })
  );

  // We return the touched files so things such as the CLI can commit them
  // if they want
  return touchedFiles;
}

type ModCompWithWorkspace = ComprehensiveRelease & {
  config: PackageJSON;
  dir: string;
};

function getNewChangelogEntry(
  releaseWithWorkspaces: ModCompWithWorkspace[],
  changesets: NewChangeset[],
  changelogConfig: false | readonly [string, any],
  cwd: string
) {
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

      let changelog = await getChangelogFunc(
        release,
        relevantChangesets,
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

async function updateChangelog(
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
