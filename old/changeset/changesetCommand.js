/* eslint-disable no-console */
const { green } = require('chalk');
// TODO: Make these pull from the actual packages once we have a firm repo structure
const cli = require('@atlaskit/build-utils/cli');
const git = require('@atlaskit/build-utils/git');
const logger = require('@atlaskit/build-utils/logger');
const path = require('path');
const {
  getChangedPackagesSinceMaster,
} = require('@atlaskit/build-utils/packages');
const fs = require('fs-extra');

const writeChangeset = require('./writeChangeset');
const createChangeset = require('./createChangeset');
const baseConfig = require('../initialize/initial/config');
const resolveUserConfig = require('../utils/resolveConfig');
const getChangesetBase = require('../utils/getChangesetBase');
const { printIntroBanner, printConfirmationMessage } = require('./messages');

async function run(opts) {
  printIntroBanner();
  const userConfig = await resolveUserConfig({ cwd: opts.cwd });
  const userchangesetOptions =
    userConfig && userConfig.changesetOptions
      ? userConfig.changesetOptions
      : {};

  const config = {
    ...baseConfig.changesetOptions,
    ...userchangesetOptions,
    ...opts,
  };
  const changesetBase = await getChangesetBase(config.cwd);

  if (!fs.existsSync(changesetBase)) {
    console.warn(
      'There is no .changeset folder. If this is the first time `@atlaskit/build-releases` has been run in this project, run `yarn build-releases initialize to get set up. If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration.',
    );
    return;
  }

  const changedPackages = await getChangedPackagesSinceMaster();
  const changePackagesName = changedPackages.map(pkg => pkg.name);
  const newChangeset = await createChangeset(changePackagesName, config);
  printConfirmationMessage(newChangeset);

  const confirmChangeset = await cli.askConfirm(
    'Is this your desired changeset?',
  );

  if (confirmChangeset) {
    const changesetID = await writeChangeset(newChangeset, config);
    if (config.commit) {
      await git.add(path.resolve(changesetBase, changesetID));
      await git.commit(`CHANGESET: ${changesetID}. ${newChangeset.summary}`);
      logger.log(green('Changeset added and committed'));
    } else {
      logger.log(green('Changeset added! - you can now commit it'));
    }
  }
}

module.exports = run;
