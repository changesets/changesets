const path = require('path');
const fs = require('fs-extra');
const logger = require('@atlaskit/build-utils/logger');
const getChangesetBase = require('../utils/getChangesetBase');

async function run({ cwd }) {
  logger.log(
    'Thanks for choosing @atlaskit/build-releases to help manage versioning in your bolt monorepo',
  );
  logger.log(
    'We are going to set you up so you can start adding and consuming changesets',
  );
  const changesetBase = await getChangesetBase(cwd);

  if (fs.existsSync(changesetBase)) {
    logger.log(
      'It looks like you already have changesets initialized. You should be able to run changeset commands no problems',
    );
  } else {
    await fs.copy(path.resolve(__dirname, './initial'), changesetBase);
    logger.log(
      'We have added a `.changeset` folder, and a couple of files to help you out. First we have a README that will help you in using changesets. We also wrote the default config options out into our config file, so you can see what they are based off',
    );
  }
}

module.exports = run;
