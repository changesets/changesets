import * as logger from "@changesets/logger";
import chalk from "chalk";
import { exitPre, enterPre } from "@changesets/pre";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
  ExitError
} from "@changesets/errors";

export default async function pre(
  cwd: string,
  options: { command: "enter"; tag: string } | { command: "exit"; tag?: string }
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
  } else {
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
  }
}
