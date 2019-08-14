import chalk from "chalk";
import { Config, NewChangeset } from "@changesets/types";
import applyReleasePlan from "@changesets/apply-release-plan";
import readChangesets from "@changesets/read";
import getDependentsgraph from "get-dependents-graph";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import getWorkspaces from "get-workspaces";

import logger from "../../utils/logger";
import * as git from "@changesets/git";
import createReleaseCommit from "./createReleaseCommit";
import { removeFolders, removeEmptyFolders } from "../../utils/removeFolders";
import getOldChangesets from "../../utils/getChangesets";

import getChangesetBase from "../../utils/getChangesetBase";

let importantSeparator = chalk.red(
  "===============================IMPORTANT!==============================="
);

// this function only exists while we wait for v1 changesets to be obsoleted
// and should be deleted before v3
async function getOldChangesetsAndWarn(
  cwd: string
): Promise<Array<NewChangeset>> {
  let changesetBase = await getChangesetBase(cwd);
  removeEmptyFolders(changesetBase);
  let unreleasedChangesets = await getOldChangesets(changesetBase, false);
  if (unreleasedChangesets.length === 0) {
    return [];
  }
  logger.warn(importantSeparator);
  logger.warn("There were old changesets from version 1 found");
  logger.warn(
    "Theses are being applied now but the dependents graph may have changed"
  );
  logger.warn("Make sure you validate all your dependencies");
  logger.warn(
    "In version 3, we will no longer apply these old changesets, and will instead throw here"
  );
  logger.warn(
    "----------------------------------------------------------------------"
  );

  let thing = unreleasedChangesets.map(({ releases, id, summary }) => ({
    releases,
    id,
    summary
  }));

  return thing;
}
// this function only exists while we wait for v1 changesets to be obsoleted
// and should be deleted before v3
async function cleanupOldChangesets(cwd: string, publishCommit: string) {
  let changesetBase = await getChangesetBase(cwd);
  removeFolders(changesetBase);

  await git.add(changesetBase, cwd);

  logger.log("Committing removing old changesets...");
  await git.commit(publishCommit, cwd);
}

export default async function version(cwd: string, config: Config) {
  let oldChangesets = await getOldChangesetsAndWarn(cwd);
  let newChangesets = await readChangesets(cwd, false);

  let changesets = [...oldChangesets, ...newChangesets];

  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!workspaces)
    throw new Error(
      "Could not resolve workspaes for current working directory"
    );

  let dependentsGraph = await getDependentsgraph({ cwd });

  // NOTE: in v3 when we are not support the old changeset format we can use `getReleasePlan` here
  let releasePlan = await assembleReleasePlan(
    changesets,
    workspaces,
    dependentsGraph,
    config
  );

  let publishCommit = createReleaseCommit(releasePlan, config.commit);

  logger.log(publishCommit);
  await applyReleasePlan(releasePlan, cwd, config);

  if (oldChangesets.length > 0 && config.commit) {
    cleanupOldChangesets(cwd, publishCommit);
  } else {
    logger.log(
      "All files have been updated. Review them and commit at your leisure"
    );
    logger.warn(
      "If you alter version changes in package.jsons, make sure to run bolt before publishing to ensure the repo is in a valid state"
    );
  }
}
