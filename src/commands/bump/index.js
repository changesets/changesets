/* eslint-disable no-use-before-define */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
import path from "path";
import * as bolt from "bolt";
import fs from "fs-extra";
import logger from "../../utils/logger";
import * as git from "../../utils/git";
import createRelease from "../../utils/createRelease";
import createReleaseCommit from "./createReleaseCommit";
import { removeFolders, removeEmptyFolders } from "../../utils/removeFolders";
import updateChangelog from "../../utils/updateChangelog";
import getChangesets from "../../utils/getChangesets";

import resolveConfig from "../../utils/resolveConfig";
import getChangesetBase from "../../utils/getChangesetBase";
import { defaultConfig } from "../../utils/constants";

export default async function version(opts) {
  let userConfig = await resolveConfig(opts);
  userConfig =
    userConfig && userConfig.versionOptions ? userConfig.versionOptions : {};
  const config = { ...defaultConfig.versionOptions, ...userConfig, ...opts };
  const cwd = config.cwd || process.cwd();
  const allPackages = await bolt.getWorkspaces({ cwd });
  const changesetBase = await getChangesetBase(cwd);
  removeEmptyFolders(changesetBase);

  const unreleasedChangesets = await getChangesets(changesetBase);
  const releaseObj = createRelease(unreleasedChangesets, allPackages);
  const publishCommit = createReleaseCommit(releaseObj, config.skipCI);

  if (unreleasedChangesets.length === 0) {
    logger.warn("No unreleased changesets found, exiting.");
    return;
  }

  logger.log(publishCommit);

  await bumpReleasedPackages(releaseObj, allPackages, config);

  // Need to transform releases into a form for bolt to update dependencies
  const versionsToUpdate = releaseObj.releases.reduce(
    (cur, next) => ({
      ...cur,
      [next.name]: next.version
    }),
    {}
  );
  // update dependencies on those versions using bolt
  const pkgPaths = await bolt.updatePackageVersions(versionsToUpdate, {
    cwd
  });

  if (config.commit) {
    for (const pkgPath of pkgPaths) {
      await git.add(pkgPath);
    }
  }

  if (config.updateChangelog) {
    logger.log("Updating changelogs...");
    // Now update the changelogs
    const changelogPaths = await updateChangelog(releaseObj, config);
    if (config.commit) {
      for (const changelogPath of changelogPaths) {
        await git.add(changelogPath);
      }
    }
  }

  logger.log("Removing changesets...");

  // This should then reset the changesets folder to a blank state
  removeFolders(changesetBase);
  if (config.commit) {
    await git.add(changesetBase);

    logger.log("Committing changes...");
    // TODO: Check if there are any unstaged changed before committing and throw
    // , as it means something went super-odd.
    await git.commit(publishCommit);
  } else {
    logger.log(
      "All files have been updated. Review them and commit at your leisure"
    );
    logger.warn(
      "If you alter version changes in package.jsons, make sure to run bolt before publishing to ensure the repo is in a valid state"
    );
  }
}

async function bumpReleasedPackages(releaseObj, allPackages, config) {
  for (const release of releaseObj.releases) {
    const pkgDir = allPackages.find(pkg => pkg.name === release.name).dir;
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath));

    pkgJson.version = release.version;
    const pkgJsonStr = `${JSON.stringify(pkgJson, null, 2)}\n`;
    await fs.writeFile(pkgJsonPath, pkgJsonStr);
    if (config.commit) {
      await git.add(pkgJsonPath);
    }
  }
}
