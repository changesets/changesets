import chalk from "chalk";
import path from "path";
import { log, warn, error } from "@changesets/logger";
import { Config } from "@changesets/types";
import applyReleasePlan from "@changesets/apply-release-plan";
import readChangesets from "@changesets/read";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { getPackages } from "@manypkg/get-packages";

import { removeEmptyFolders } from "../../utils/v1-legacy/removeFolders";
import { readPreState } from "@changesets/pre";
import { ExitError } from "@changesets/errors";

let importantSeparator = chalk.red(
  "===============================IMPORTANT!==============================="
);

let importantEnd = chalk.red(
  "----------------------------------------------------------------------"
);

export default async function version(
  cwd: string,
  options: {
    snapshot?: string | boolean;
  },
  config: Config
) {
  let [_changesets, _preState] = await Promise.all([
    readChangesets(cwd),
    readPreState(cwd),
    removeEmptyFolders(path.resolve(cwd, ".changeset"))
  ]);
  let releaseConfig = config;

  // temporarily needed because of TS 3.7 regression - https://github.com/microsoft/TypeScript/issues/33752
  const changesets = _changesets as NonNullable<typeof _changesets>;
  const preState = _preState as NonNullable<typeof _preState>;

  if (preState !== undefined && preState.mode === "pre") {
    releaseConfig = { ...releaseConfig, commit: false };

    warn(importantSeparator);
    if (options.snapshot !== undefined) {
      error("Snapshot release is not allowed in pre mode");
      log("To resolve this exit the pre mode by running `changeset pre exit`");
      throw new ExitError(1);
    } else {
      warn("You are in prerelease mode");
      warn(
        "If you meant to do a normal release you should revert these changes and run `changeset pre exit`"
      );
      warn("You can then run `changeset version` again to do a normal release");
    }
    warn(importantEnd);
  }

  if (
    changesets.length === 0 &&
    (preState === undefined || preState.mode !== "exit")
  ) {
    warn("No unreleased changesets found, exiting.");
    return;
  }

  let packages = await getPackages(cwd);

  let releasePlan = assembleReleasePlan(
    changesets,
    packages,
    releaseConfig,
    preState,
    options.snapshot
  );

  await applyReleasePlan(
    releasePlan,
    packages,
    releaseConfig,
    options.snapshot
  );

  if (options.snapshot !== undefined && releaseConfig.commit) {
    log("All files have been updated and committed. You're ready to publish!");
  } else {
    log("All files have been updated. Review them and commit at your leisure");
  }
}
