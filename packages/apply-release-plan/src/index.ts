import {
  ReleasePlan,
  Config,
  ChangelogFunctions,
  NewChangeset,
  ModCompWithWorkspace,
  PreState,
  VersionType
} from "@changesets/types";
import startCase from "lodash.startcase";

import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import getWorkspaces from "get-workspaces";
import resolveFrom from "resolve-from";

import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

import versionPackage from "./version-package";
import createVersionCommit from "./createVersionCommit";
import getChangelogEntry from "./get-changelog-entry";

async function getCommitThatAddsChangeset(changesetId: string, cwd: string) {
  let commit = await git.getCommitThatAddsFile(
    `.changeset/${changesetId}.md`,
    cwd
  );
  if (commit) {
    return commit;
  }
  let commitForOldChangeset = await git.getCommitThatAddsFile(
    `.changeset/${changesetId}/changes.json`,
    cwd
  );
  if (commitForOldChangeset) {
    return commitForOldChangeset;
  }
}

export default async function applyReleasePlan(
  releasePlan: ReleasePlan,
  cwd: string,
  config: Config = defaultConfig
) {
  let touchedFiles = [];
  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!workspaces) throw new Error(`could not find any workspaces in ${cwd}`);

  const workspacesByName = new Map(workspaces.map(x => [x.name, x]));

  let { releases, changesets } = releasePlan;

  const versionCommit = createVersionCommit(releasePlan, config.commit);

  let releaseWithWorkspaces = releases.map(release => {
    let workspace = workspacesByName.get(release.name);
    if (!workspace)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`
      );
    return { ...release, config: workspace.config, dir: workspace.dir };
  });

  // I think this might be the wrong place to do this, but gotta do it somewhere -  add changelog entries to releases
  let {
    releaseWithChangelogs,
    preState: updatedPreState
  } = await getNewChangelogEntry(
    releaseWithWorkspaces,
    changesets,
    config.changelog,
    cwd,
    releasePlan.preState
  );

  if (updatedPreState !== undefined) {
    if (updatedPreState.mode === "exit") {
      await fs.remove(path.join(cwd, ".changeset", "pre.json"));
    } else {
      await fs.writeFile(
        path.join(cwd, ".changeset", "pre.json"),
        JSON.stringify(updatedPreState, null, 2) + "\n"
      );
    }
  }

  let versionsToUpdate = releases.map(({ name, newVersion }) => ({
    name,
    version: newVersion
  }));

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
      parser: "json",
      printWidth: 20
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
    changesets.map(async changeset => {
      let changesetPath = path.resolve(changesetFolder, `${changeset.id}.md`);
      let changesetFolderPath = path.resolve(changesetFolder, changeset.id);
      if (await fs.pathExists(changesetPath)) {
        touchedFiles.push(changesetPath);
        await fs.remove(changesetPath);
        // TO REMOVE LOGIC - this works to remove v1 changesets. We should be removed in the future
      } else if (await fs.pathExists(changesetFolderPath)) {
        touchedFiles.push(changesetFolderPath);
        await fs.remove(changesetFolderPath);
      }
    })
  );

  if (config.commit) {
    let newTouchedFilesArr = [...touchedFiles];
    // Note, git gets angry if you try and have two git actions running at once
    // So we need to be careful that these iterations are properly sequential
    while (newTouchedFilesArr.length > 0) {
      let file = newTouchedFilesArr.shift();
      await git.add(path.relative(cwd, file!), cwd);
    }

    let commit = await git.commit(versionCommit, cwd);

    if (!commit) {
      console.error("Changesets ran into trouble committing your files");
    }
  }

  // We return the touched files mostly for testing purposes
  return touchedFiles;
}

function smallHelper(
  obj: { major: string[]; minor: string[]; patch: string[] },
  type: VersionType
) {
  const releaseLines = obj[type];
  if (!releaseLines.length) return "";

  return `### ${startCase(type)} Changes\n\n${releaseLines.join("")}`;
}

async function getNewChangelogEntry(
  releaseWithWorkspaces: ModCompWithWorkspace[],
  changesets: NewChangeset[],
  changelogConfig: false | readonly [string, any],
  cwd: string,
  preState: PreState | undefined
) {
  let getChangelogFuncs: ChangelogFunctions = {
    getReleaseLine: () => Promise.resolve(""),
    getDependencyReleaseLine: () => Promise.resolve("")
  };
  let changelogOpts: any;
  if (changelogConfig) {
    changelogOpts = changelogConfig[1];
    let changesetPath = path.join(cwd, ".changeset");
    let changelogPath = resolveFrom(changesetPath, changelogConfig[0]);

    let possibleChangelogFunc = require(changelogPath);
    if (possibleChangelogFunc.default) {
      possibleChangelogFunc = possibleChangelogFunc.default;
    }
    if (
      typeof possibleChangelogFunc.getReleaseLine === "function" &&
      typeof possibleChangelogFunc.getDependencyReleaseLine === "function"
    ) {
      getChangelogFuncs = possibleChangelogFunc;
    } else {
      throw new Error("Could not resolve changelog generation functions");
    }
  }

  let moddedChangesets = await Promise.all(
    changesets.map(async cs => ({
      ...cs,
      commit: await getCommitThatAddsChangeset(cs.id, cwd)
    }))
  );

  let preStatePackages =
    preState === undefined
      ? undefined
      : {
          ...preState.packages
        };

  return {
    releaseWithChangelogs: await Promise.all(
      releaseWithWorkspaces.map(async release => {
        try {
          let releaseLines = await getChangelogEntry(
            release,
            releaseWithWorkspaces,
            moddedChangesets,
            getChangelogFuncs,
            changelogOpts,
            preState
          );
          if (preStatePackages) {
            preStatePackages[release.name] = {
              ...preStatePackages[release.name],
              releaseLines: {
                major: preStatePackages[release.name].releaseLines.major.concat(
                  releaseLines.major
                ),
                minor: preStatePackages[release.name].releaseLines.minor.concat(
                  releaseLines.minor
                ),
                patch: preStatePackages[release.name].releaseLines.patch.concat(
                  releaseLines.patch
                )
              }
            };
          }

          return {
            ...release,
            changelog: [
              `## ${release.newVersion}`,
              smallHelper(releaseLines, "major"),
              smallHelper(releaseLines, "minor"),
              smallHelper(releaseLines, "patch")
            ]
              .filter(line => line)
              .join("\n")
          };
        } catch (e) {
          console.error(
            "The following error was encountered while generating changelog entries"
          );
          console.error(
            "We have escaped applying the changesets, and no files should have been affected"
          );
          throw e;
        }
      })
    ),
    preState:
      preState === undefined
        ? undefined
        : { ...preState, packages: preStatePackages }
  };
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
    await fs.writeFile(
      filePath,
      prettier.format(completelyNewChangelog, {
        ...prettierConfig,
        parser: "markdown"
      })
    );
    return;
  }
  const newChangelog = fileData.replace("\n", data);

  await fs.writeFile(
    filePath,
    prettier.format(newChangelog, { ...prettierConfig, parser: "markdown" })
  );
}
