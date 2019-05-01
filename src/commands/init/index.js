import path from "path";
import fs from "fs-extra";
import logger from "../../utils/logger";
import getChangesetBase from "../../utils/getChangesetBase";
import { pkgPath } from "../../utils/constants";

export default async function init({ cwd }) {
  logger.log(
    "Thanks for choosing changesets to help manage your versioning and publishing"
  );
  logger.log(
    "We are going to set you up so you can start adding and consuming changesets"
  );
  const changesetBase = await getChangesetBase(cwd);

  if (fs.existsSync(changesetBase)) {
    logger.log(
      "It looks like you already have changesets initialized. You should be able to run changeset commands no problems"
    );
  } else {
    await fs.copy(path.resolve(pkgPath, "./default-files"), changesetBase);
    logger.log(
      "We have added a `.changeset` folder, and a couple of files to help you out. First we have a README that will help you in using changesets. We also wrote the default config options out into our config file, so you can see what they are based off"
    );
  }
}
