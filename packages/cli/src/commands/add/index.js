import { green, blue } from "chalk";
import path from "path";
import fs from "fs-extra";

import * as cli from "../../utils/cli";
import * as git from "../../utils/git";
import logger from "../../utils/logger";

import writeChangeset from "./writeChangeset";
import createChangeset from "./createChangeset";
import { defaultConfig } from "../../utils/constants";
import resolveUserConfig from "../../utils/resolveConfig";
import getChangesetBase from "../../utils/getChangesetBase";
import { printConfirmationMessage } from "./messages";

export default async function add(opts) {
  const userConfig = await resolveUserConfig({ cwd: opts.cwd });
  const userchangesetOptions =
    userConfig && userConfig.changesetOptions
      ? userConfig.changesetOptions
      : {};

  const config = {
    ...defaultConfig.changesetOptions,
    ...userchangesetOptions,
    ...opts
  };
  const changesetBase = await getChangesetBase(config.cwd);

  if (!fs.existsSync(changesetBase)) {
    console.warn(
      "There is no .changeset folder. If this is the first time `changesets` have been used in this project, run `yarn changesets init` to get set up. If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration."
    );
    return;
  }

  const changedPackages = await git.getChangedPackagesSinceMaster(config.cwd);
  const changePackagesName = changedPackages.map(pkg => pkg.name);
  const newChangeset = await createChangeset(changePackagesName, config);
  printConfirmationMessage(newChangeset);

  const confirmChangeset = await cli.askConfirm(
    "Is this your desired changeset?"
  );

  if (confirmChangeset) {
    const changesetID = await writeChangeset(newChangeset, config);
    if (config.commit) {
      await git.add(path.resolve(changesetBase, changesetID), config.cwd);
      await git.commit(
        `CHANGESET: ${changesetID}. ${newChangeset.summary}`,
        config.cwd
      );
      logger.log(green("Changeset added and committed"));
    } else {
      logger.log(green("Changeset added! - you can now commit it\n"));
    }

    let hasMajorChange = [
      ...newChangeset.releases,
      ...newChangeset.dependents
    ].find(c => c.type === "major");

    if (hasMajorChange) {
      logger.warn(
        "This Changeset includes a major change and we STRONGLY recommend adding more information to the changeset:"
      );
      logger.warn("WHAT the breaking change is");
      logger.warn("WHY the change was made");
      logger.warn("HOW a consumer should update their code");
    } else {
      logger.log(
        green(
          "If you want to modify or expand on the changeset summary, you can find it here"
        )
      );
    }
    logger.info(blue(path.resolve(changesetBase, changesetID, "changes.md")));
  }
}
