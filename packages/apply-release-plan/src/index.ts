import {
  ReleasePlan,
  Config,
  ComprehensiveRelease,
  NewChangeset
} from "@changesets/types";

import getWorksaces from "get-workspaces";
import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

import versionPackage from "./version-package";

const badDefaultConfig = {
  changelog: (
    /* eslint-disable */
    releasePlan: ComprehensiveRelease,
    changesets: NewChangeset[]
    /* eslint-enable */
  ): Promise<string> => new Promise(resolve => resolve(""))
};

export default async function applyReleasePlan(
  releasePlan: ReleasePlan,
  cwd: string,
  config: Config = badDefaultConfig
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
  let releaseWithChangelogs = releaseWithWorkspaces.map(release => ({
    ...release,
    changelog: config.changelog(release, changesets)
  }));

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

    await Promise.all([
      fs.writeFile(pkgJSONPath, config),
      updateChangelog(changelogPath, changelog, name, prettierConfig)
    ]);
    touchedFiles.push(pkgJSONPath, changelogPath);
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

async function updateChangelog(
  changelogPath: string,
  changelogPromise: Promise<string>,
  name: string,
  prettierConfig: Object
) {
  let changelog = await changelogPromise;
  let templateString = `\n\n${changelog.trim("\n")}\n`;

  try {
    if (fs.existsSync(changelogPath)) {
      await prependFile(changelogPath, templateString, name, prettierConfig);
    } else {
      await fs.writeFile(changelogPath, `# ${name}${templateString}`);
    }
  } catch (e) {
    logger.warn(e);
    return;
  }
}

async function prependFile(
  filePath: string,
  data: string,
  name: string,
  prettierConfig: prettier.Options
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
