import path from "path";
import fs from "fs-extra";
import chalk from "chalk";

import logger from "../../utils/logger";
import getChangesetBase from "../../utils/getChangesetBase";
import { defaultWrittenConfig } from "@changesets/config";

const pkgPath = path.dirname(require.resolve("@changesets/cli/package.json"));

export default async function init(cwd: string) {
  const changesetBase = await getChangesetBase(cwd);

  if (fs.existsSync(changesetBase)) {
    if (!fs.existsSync(path.join(changesetBase, "config.json"))) {
      if (fs.existsSync(path.join(changesetBase, "config.js"))) {
        logger.error(
          "It looks like you're using the version 1 `.changeset/config.js` file"
        );
        logger.error(
          "The format of the config object has significantly changed in v2 as well"
        );
        logger.error(
          " - we thoroughly recommend looking at the changelog for this package for what has changed"
        );
        logger.error(
          "Changesets will write the defaults for the new config, remember to transfer your options into the new config at `.changeset/config.json`"
        );
      } else {
        logger.error("It looks like you don't have a config file");
        logger.info(
          "The default config file will be written at `.changeset/config.json`"
        );
      }
      await fs.writeFile(
        path.resolve(changesetBase, "config.json"),
        JSON.stringify(defaultWrittenConfig, null, 2)
      );
    } else {
      logger.warn(
        "It looks like you already have changesets initialized. You should be able to run changeset commands no problems."
      );
    }
  } else {
    await fs.copy(path.resolve(pkgPath, "./default-files"), changesetBase);
    await fs.writeFile(
      path.resolve(changesetBase, "config.json"),
      JSON.stringify(defaultWrittenConfig, null, 2)
    );

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
    logger.info(chalk`- {blue .changeset/config.json} is our default config`);
  }
}
