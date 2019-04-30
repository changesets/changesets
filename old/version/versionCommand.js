const path = require('path');
const bolt = require('bolt');
const logger = require('@atlaskit/build-utils/logger');
const git = require('@atlaskit/build-utils/git');
const createRelease = require('./createRelease');
const createReleaseCommit = require('./createReleaseCommit');
const { removeFolders } = require('../utils/removeFolders');
const updateChangelog = require('../changelog');
const fs = require('@atlaskit/build-utils/fs');
const fse = require('fs-extra');
const resolveConfig = require('../utils/resolveConfig');
const { removeEmptyFolders } = require('../utils/removeFolders');
const getChangesetBase = require('../utils/getChangesetBase');
const { versionOptions } = require('../initialize/initial/config');

async function bumpReleasedPackages(releaseObj, allPackages, config) {
  for (const release of releaseObj.releases) {
    const pkgDir = allPackages.find(pkg => pkg.name === release.name).dir;
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath));

    pkgJson.version = release.version;
    const pkgJsonStr = `${JSON.stringify(pkgJson, null, 2)}\n`;
    await fs.writeFile(pkgJsonPath, pkgJsonStr);
    if (config.commit) {
      await git.add(pkgJsonPath);
    }
  }
}

// TODO: This old method of writing changesets is being removed, however we are reading from it
// for a grace period. Once this is done, we will need to:
//    1. Remove this function
// This should be done by the beginning of 2019
async function getOldCommitChangesets() {
  const lastPublishCommit = await git.getLastPublishCommit();
  // getUnpublishedChangesetCommits takes a 'since' flag, we do commits since last publish
  const unreleasedChangesets = await git.getUnpublishedChangesetCommits(
    lastPublishCommit,
  );
  return unreleasedChangesets || [];
}

async function getNewFSChangesets(changesetBase) {
  removeEmptyFolders(changesetBase);
  if (!fse.existsSync(changesetBase)) {
    throw new Error('There is no .changeset directory in this project');
  }

  const dirs = fse.readdirSync(changesetBase);
  // this needs to support just not dealing with dirs that aren't set up properly
  const changesets = dirs
    .filter(file => fse.lstatSync(path.join(changesetBase, file)).isDirectory())
    .map(async changesetDir => {
      const summary = fse.readFileSync(
        path.join(changesetBase, changesetDir, 'changes.md'),
        'utf-8',
      );
      const jsonPath = path.join(changesetBase, changesetDir, 'changes.json');
      const json = require(jsonPath);
      const commit = await git.getCommitThatAddsFile(jsonPath);
      return { ...json, summary, commit };
    });
  return Promise.all(changesets);
}

async function run(opts) {
  let userConfig = await resolveConfig(opts);
  userConfig =
    userConfig && userConfig.versionOptions ? userConfig.versionOptions : {};
  const config = { ...versionOptions, ...userConfig, ...opts };
  const cwd = config.cwd || process.cwd();
  const noChangelogFlag = config.noChangelog;
  const allPackages = await bolt.getWorkspaces({ cwd });
  const changesetBase = await getChangesetBase(cwd);
  const oldChangesets = await getOldCommitChangesets();
  const newChangesets = await getNewFSChangesets(changesetBase);
  const unreleasedChangesets = [...oldChangesets, ...newChangesets];
  const releaseObj = createRelease(unreleasedChangesets, allPackages);
  const publishCommit = createReleaseCommit(releaseObj, config.skipCI);

  if (unreleasedChangesets.length === 0) {
    logger.warn('No unreleased changesets found, exiting.');
    return;
  }

  logger.log(publishCommit);

  await bumpReleasedPackages(releaseObj, allPackages, config);

  // Need to transform releases into a form for bolt to update dependencies
  const versionsToUpdate = releaseObj.releases.reduce(
    (cur, next) => ({
      ...cur,
      [next.name]: next.version,
    }),
    {},
  );
  // update dependencies on those versions using bolt
  const pkgPaths = await bolt.updatePackageVersions(versionsToUpdate, {
    cwd,
  });

  if (config.commit) {
    for (const pkgPath of pkgPaths) {
      await git.add(pkgPath);
    }
  }

  // This double negative is bad, but cleaner than the alternative
  if (!noChangelogFlag) {
    logger.log('Updating changelogs...');
    // Now update the changelogs
    const changelogPaths = await updateChangelog(releaseObj, config);
    if (config.commit) {
      for (const changelogPath of changelogPaths) {
        await git.add(changelogPath);
      }
    }
  }

  logger.log('Removing changesets...');

  // This should then reset the changesets folder to a blank state
  removeFolders(changesetBase);
  if (config.commit) {
    await git.add(changesetBase);

    logger.log('Committing changes...');
    // TODO: Check if there are any unstaged changed before committing and throw
    // , as it means something went super-odd.
    await git.commit(publishCommit);
  } else {
    logger.log(
      'All files have been updated. Review them and commit at your leisure',
    );
    logger.warn(
      'If you alter version changes in package.jsons, make sure to run bolt before publishing to ensure the repo is in a valid state',
    );
  }
}

module.exports = run;
