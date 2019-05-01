import * as bolt from "bolt";
import chalk from "chalk";

import getChangesetBase from "../../utils/getChangesetBase";
import logger from "../../utils/logger";
import getChangesets from "../../utils/getChangesets";

import createRelease from "../../utils/createRelease";

function printReleasesOfType(type, releases) {
  const packages = releases.filter(r => r.type === type);

  if (packages.length) {
    logger.info(
      chalk`Running release will release the following packages as a {green ${type}}:`
    );
    packages.forEach(({ name, version, changesets }) => {
      logger.log(
        chalk`    {green ${name}} - ${version} - ${changesets
          .map(c => chalk`{blue .changeset/${c}/changes.md}`)
      );
    });
    logger.log("\n");
  } else {
    logger.info(
      chalk`Running release would release {red no} packages as a {green ${type}}`
    );
  }
}

export default async function getStatus({ cwd, sinceMaster }) {
  const changesetBase = await getChangesetBase(cwd);
  const allPackages = await bolt.getWorkspaces({ cwd });
  const changesets = await getChangesets(changesetBase, sinceMaster);

  if (changesets.length < 1) {
    logger.error("No changesets present");
    process.exit(1);
  }

  const { releases } = createRelease(changesets, allPackages);

  printReleasesOfType("patch", releases);
  printReleasesOfType("minor", releases);
  printReleasesOfType("major", releases);

  // Read in all current changes.json files
  // Process what the release would look like
  // print release info in terminal

  /*
    Other notes:
    - If there are no changesets, should print an error and exit with an error status code
    - sinceMaster filters to only changesets since master, and otherwise follows normal behaviours
        - this means `changesets status --sinceMaster` can be used for CI checks for are there changesets
    - verbose flag shows all updated changelog entries, not just updated dependencies
    */
}
