import { ReleasePlan, Config } from "@changesets/types";
import { defaultConfig } from "@changesets/config";
import getWorksaces from "get-workspaces";
import { getNewChangelogEntry, updateChangelog } from "./update-changelogs";

import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

import versionPackage from "./version-package";

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
