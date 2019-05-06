import path from "path";
import fs from "fs-extra";
import chalk from "chalk";

import logger from "../../utils/logger";
import getChangesetBase from "../../utils/getChangesetBase";
import { pkgPath } from "../../utils/constants";

export default async function init({ cwd }) {
  const changesetBase = await getChangesetBase(cwd);

  if (fs.existsSync(changesetBase)) {
    logger.warn(
      "It looks like you already have changesets initialized. You should be able to run changeset commands no problems."
    );
  } else {
    await fs.copy(path.resolve(pkgPath, "./default-files"), changesetBase);
    logger.log(
      chalk`Thanks for choosing {green changesets} to help manage your versioning and publishing\n`
    );
    logger.log("You should be set up to start using changesets now!\n");

    logger.info(
      "We have added a `.changeset` folder, and a couple of files to help you out:"
    );
    logger.info(
      chalk`- {blue .changeset/README.md} contains information about using changesets`
    );
    logger.info(
      chalk`- {blue .changeset/config.js} is our default config, with a lot of comments about each option.`
    );
  }
}
