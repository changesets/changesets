import * as logger from "@changesets/logger";
import { exitPre, enterPre } from "@changesets/pre";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
  ExitError
} from "@changesets/errors";

export default async function pre(
  cwd: string,
  options: { tag: string; command: "enter" } | { command: "exit"; tag?: string }
) {
  if (options.command === "enter") {
    try {
      await enterPre(cwd, options.tag);
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        logger.error(
          "`changeset pre enter` cannot be run when in prerelease mode"
        );
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
