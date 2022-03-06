import chalk from "chalk";
import path from "path";
import * as git from "@changesets/git";
import { log, warn, error } from "@changesets/logger";
import { Config } from "@changesets/types";
import applyReleasePlan from "@changesets/apply-release-plan";
import readChangesets from "@changesets/read";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { getPackages } from "@manypkg/get-packages";

import { removeEmptyFolders } from "../../utils/v1-legacy/removeFolders";
import { readPreState } from "@changesets/pre";
import { ExitError } from "@changesets/errors";
import { getCommitFuncs } from "../../commit";

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
  const releaseConfig = {
    ...config,
    // Disable committing when in snapshot mode
    commit: options.snapshot ? false : config.commit
  };
  const [changesets, preState] = await Promise.all([
    readChangesets(cwd),
    readPreState(cwd),
    removeEmptyFolders(path.resolve(cwd, ".changeset"))
  ]);

  if (preState?.mode === "pre") {
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

  let touchedFiles = await applyReleasePlan(
    releasePlan,
    packages,
    releaseConfig,
    options.snapshot
  );

  if (releaseConfig.commit) {
    let newTouchedFilesArr = [...touchedFiles];
    // Note, git gets angry if you try and have two git actions running at once
    // So we need to be careful that these iterations are properly sequential
    while (newTouchedFilesArr.length > 0) {
      let file = newTouchedFilesArr.shift();
      await git.add(path.relative(cwd, file!), cwd);
    }

    const [{ getVersionMessage }, commitOpts] = getCommitFuncs(
      releaseConfig.commit,
      cwd
    );
    const commit = await git.commit(
      await getVersionMessage(releasePlan, commitOpts),
      cwd
    );

    if (!commit) {
      error("Changesets ran into trouble committing your files");
    } else {
      log(
        "All files have been updated and committed. You're ready to publish!"
      );
    }
  } else {
    log("All files have been updated. Review them and commit at your leisure");
  }
}
