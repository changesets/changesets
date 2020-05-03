import * as logger from "@changesets/logger";
import chalk from "chalk";
import { exitPre, enterPre } from "@changesets/pre";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
  ExitError
} from "@changesets/errors";
import { getLastCommitHash } from "@changesets/git";
import { read } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";
import version from "../version";

export default async function pre(
  cwd: string,
  options:
    | { command: "enter"; tag: string }
    | { command: "exit"; tag?: string }
    | { command: "snapshot"; tag: string }
) {
  if (options.command === "enter") {
    try {
      await enterPre(cwd, options.tag);
      logger.success(`Entered pre mode with tag ${chalk.cyan(options.tag)}`);
      logger.info(
        "Run `changeset version` to version packages with prerelease versions"
      );
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        logger.error("`changeset pre enter` cannot be run when in pre mode");
        logger.info(
          "If you're trying to exit pre mode, run `changeset pre exit`"
        );
        throw new ExitError(1);
      }
      throw err;
    }
  } else if (options.command === "exit") {
    try {
      await exitPre(cwd);
      logger.success(`Exited pre mode`);
      logger.info(
        "Run `changeset version` to version packages with normal versions"
      );
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        logger.error("`changeset pre exit` can only be run when in pre mode");
        logger.info(
          "If you're trying to enter pre mode, run `changeset pre enter`"
        );
        throw new ExitError(1);
      }
      throw err;
    }
  } else {
    /**
     * Snapshot command:
     * Assemble the release plan
     * Apply the release plan
     */

    // Get latest commit hash to get unique version
    const lastCommitHash = await getLastCommitHash(cwd);

    if (lastCommitHash === false) {
      logger.error(`Unable to get last git commit hash for snapshot version.`);
      logger.error(
        `To fix this please make sure you have git installed, and this is a git repository.`
      );
      throw new ExitError(1);
    }

    // Get the first 7 characters of the commit hash to identify version
    const readableCommitHash = lastCommitHash.slice(0, 7);

    const packages = await getPackages(cwd);
    let config = await read(cwd, packages);

    // We should not commit the snapshot version
    let updatedConfig = {
      ...config,
      commit: false
    };

    await version(cwd, updatedConfig, {
      tag: options.tag,
      commitHash: readableCommitHash
    });

    logger.log("All the files have been updated with snapshot release.");
    logger.log("Please run `changesets publish` to release the packages");
  }
}
