import { Config } from "@changesets/types";
import logger from "../../utils/logger";
import { ExitError } from "../../utils/errors";
import { exitPre, enterPre } from "@changesets/pre";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError
} from "@changesets/errors";

export default async function pre(
  cwd: string,
  options:
    | { tag: string; command: "enter" }
    | { command: "exit"; tag?: string },
  config: Config
) {
  if (options.command === "enter") {
    try {
      enterPre(cwd, options.tag);
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        logger.error(
          "`changeset prerelease enter` cannot be run when in prerelease mode"
        );
        logger.info(
          "If you're trying to exit prerelease mode, run `changeset prerelease exit`"
        );
        throw new ExitError(1);
      }
      throw err;
    }
  } else {
    try {
      exitPre(cwd);
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        logger.error(
          "`changeset prerelease exit` can only be run when in prerelease mode"
        );
        logger.info(
          "If you're trying to enter prerelease mode, run `changeset prerelease enter`"
        );
        throw new ExitError(1);
      }
      throw err;
    }
  }
}
