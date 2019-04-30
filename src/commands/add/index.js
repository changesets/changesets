import fs from "fs-extra";
import path from "path";
import outdent from "outdent";
import boxen from "boxen";
import { green, red } from "chalk";

import resolveUserConfig from "../../utils/resolveUserConfig";
import cli from "../../utils/cli";
import {
  getChangedPackagesSinceMaster,
  add as gitAdd,
  commit as gitCommit
} from "../../utils/git";
import baseConfig from "../init/default-files/config";
import createChangeset from "./createChangeset";
import writeChangeset from "./writeChangeset";

const logger = console;

function printConfirmationMessage(changeset) {
  function getReleasesOfType(type) {
    return changeset.releases
      .filter(release => release.type === type)
      .map(release => release.name);
  }
  logger.log("=== Releasing the following packages ===");
  const majorReleases = getReleasesOfType("major");
  const minorReleases = getReleasesOfType("minor");
  const patchReleases = getReleasesOfType("patch");
  const patchDependents = changeset.dependents
    .filter(dep => dep.type === "patch")
    .map(dep => dep.name);
  const majorDependents = changeset.dependents
    .filter(dep => dep.type === "major")
    .map(dep => red(dep.name));

  if (majorReleases.length > 0)
    logger.log(`${green("[Major]")}\n  ${majorReleases.join(", ")}`);
  if (minorReleases.length > 0)
    logger.log(`${green("[Minor]")}\n  ${minorReleases.join(", ")}`);
  if (patchReleases.length > 0)
    logger.log(`${green("[Patch]")}\n  ${patchReleases.join(", ")}`);
  if (patchDependents.length > 0)
    logger.log(
      `${green("[Dependents (patch)]")}\n  ${patchDependents.join("\n  ")}`
    );
  if (majorDependents.length > 0)
    logger.log(
      `${green("[Dependents (major)]")}\n  ${majorDependents.join("\n  ")}`
    );

  if (changeset.dependents.length > 0) {
    const message = outdent`
      ${red("========= NOTE ========")}
      All dependents that are bumped will be ${red("patch bumped")}.
      If any of the above need a higher bump than this, you will need to create a ${red(
        "separate changeset"
      )} for this
      Please read the above list ${red(
        "carefully"
      )} to make sure you're not missing anything!`;
    const prettyMessage = boxen(message, {
      borderStyle: "double",
      align: "center"
    });
    logger.log(prettyMessage);
  }
}

export default async function add(opts) {
  const userConfig = await resolveUserConfig({ cwd: opts.cwd });
  const changesetOpts =
    userConfig && userConfig.changesetOptions
      ? userConfig.changesetOptions
      : baseConfig.changesetOptions;

  const config = {
    ...changesetOpts,
    ...opts
  };

  const changesetBase = await path.resolve(config.cwd, ".changeset");

  if (!fs.existsSync(changesetBase)) {
    console.warn(
      "There is no .changeset folder. If this is the first time `changesets` has been run in this project, run `yarn changesets init to get set up. If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration."
    );
    return;
  }

  const changedPackages = await getChangedPackagesSinceMaster(config.cwd);
  const changePackagesName = changedPackages.map(pkg => pkg.name);

  const newChangeset = await createChangeset(changePackagesName, config);

  printConfirmationMessage(newChangeset);

  const confirmChangeset = await cli.askConfirm(
    "Is this your desired changeset?"
  );

  if (confirmChangeset) {
    const changesetID = await writeChangeset(newChangeset, config);
    if (config.commit) {
      await gitAdd(path.resolve(changesetBase, changesetID));
      await gitCommit(`CHANGESET: ${changesetID}. ${newChangeset.summary}`);
      console.log(green("Changeset added and committed"));
    } else {
      console.log(green("Changeset added! - you can now commit it"));
    }
  }
}
