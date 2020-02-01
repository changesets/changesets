import chalk from "chalk";
import path from "path";
import { log, warn } from "@changesets/logger";
import { Config } from "@changesets/types";
import applyReleasePlan from "@changesets/apply-release-plan";
import readChangesets from "@changesets/read";
import getDependentsgraph from "get-dependents-graph";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import getWorkspaces from "get-workspaces";

import { removeEmptyFolders } from "../../utils/v1-legacy/removeFolders";
import { readPreState } from "@changesets/pre";

let importantSeparator = chalk.red(
  "===============================IMPORTANT!==============================="
);

let importantEnd = chalk.red(
  "----------------------------------------------------------------------"
);

export default async function version(cwd: string, config: Config) {
  let [_changesets, _preState] = await Promise.all([
    readChangesets(cwd),
    readPreState(cwd),
    removeEmptyFolders(path.resolve(cwd, ".changeset"))
  ]);

  // temporarily needed because of TS 3.7 regression - https://github.com/microsoft/TypeScript/issues/33752
  const changesets = _changesets as NonNullable<typeof _changesets>;
  const preState = _preState as NonNullable<typeof _preState>;

  if (preState !== undefined && preState.mode === "pre") {
    warn(importantSeparator);
    warn("You are in prerelease mode");
    warn(
      "If you meant to do a normal release you should revert these changes and run `changeset pre exits`"
    );
    warn("You can then run `changeset version` again to do a normal release");
    warn(importantEnd);
  }

  if (
    changesets.length === 0 &&
    (preState === undefined || preState.mode !== "exit")
  ) {
    warn("No unreleased changesets found, exiting.");
    return;
  }

  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "pnpm", "root"]
  });

  if (!workspaces)
    throw new Error(
      "Could not resolve workspaces for current working directory"
    );

  let dependentsGraph = await getDependentsgraph({ cwd });

  // NOTE: in v3 when we are not support the old changeset format we can use `getReleasePlan` here
  let releasePlan = assembleReleasePlan(
    changesets,
    workspaces,
    dependentsGraph,
    config,
    preState
  );

  await applyReleasePlan(releasePlan, cwd, config);

  if (config.commit) {
    log("All files have been updated and committed. You're ready to publish!");
  } else {
    log("All files have been updated. Review them and commit at your leisure");
  }
}
