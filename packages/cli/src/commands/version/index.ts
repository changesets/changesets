import chalk from "chalk";
import { log, warn } from "@changesets/logger";
import { Config, NewChangeset } from "@changesets/types";
import applyReleasePlan from "@changesets/apply-release-plan";
import readChangesets from "@changesets/read";
import getDependentsgraph from "get-dependents-graph";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import getWorkspaces from "get-workspaces";

import { removeEmptyFolders } from "../../utils/v1-legacy/removeFolders";
import getOldChangesets from "../../utils/v1-legacy/getChangesets";

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
  warn(importantSeparator);
  warn("There were old changesets from version 1 found");
  warn(
    "Theses are being applied now but the dependents graph may have changed"
  );
  warn("Make sure you validate all your dependencies");
  warn(
    "In a future major version, we will no longer apply these old changesets, and will instead throw here"
  );
  warn(
    "----------------------------------------------------------------------"
  );

  let thing = unreleasedChangesets.map(({ releases, id, summary }) => ({
    releases,
    id,
    summary
  }));

  return thing;
}

export default async function version(cwd: string, config: Config) {
  let oldChangesets = await getOldChangesetsAndWarn(cwd);
  let newChangesets = await readChangesets(cwd, false);

  let changesets = [...oldChangesets, ...newChangesets];

  if (changesets.length === 0) {
    warn("No unreleased changesets found, exiting.");
    return;
  }

  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!workspaces)
    throw new Error(
      "Could not resolve workspaces for current working directory"
    );

  let dependentsGraph = await getDependentsgraph({ cwd });

  // NOTE: in v3 when we are not support the old changeset format we can use `getReleasePlan` here
  let releasePlan = await assembleReleasePlan(
    changesets,
    workspaces,
    dependentsGraph,
    config
  );

  await applyReleasePlan(releasePlan, cwd, config);

  if (config.commit) {
    log("All files have been updated and committed. You're ready to publish!");
  } else {
    log("All files have been updated. Review them and commit at your leisure");
  }
}
