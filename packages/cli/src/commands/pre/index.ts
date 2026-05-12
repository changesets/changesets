import color from "@changesets/color";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
  ExitError,
} from "@changesets/errors";
import { exitPre, enterPre } from "@changesets/pre";
import { log } from "@clack/prompts";

export async function pre(
  rootDir: string,
  options:
    | { command: "enter"; tag: string }
    | { command: "exit"; tag?: string },
) {
  if (options.command === "enter") {
    try {
      await enterPre(rootDir, options.tag);
      log.success(
        `
Entered pre mode with tag ${color.green(options.tag)}!
Run ${color.cyan("changeset version")} to version packages with prerelease versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        log.error(
          `
${color.cyan("changeset pre enter")} cannot be run when in pre mode.
If you're trying to exit pre mode, run ${color.cyan("changeset pre exit")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  } else {
    try {
      await exitPre(rootDir);
      log.success(
        `
Exited pre mode!
Run ${color.cyan("changeset version")} to version packages with normal versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        log.error(
          `
${color.cyan("changeset pre exit")} can only be run when in pre mode!
If you're trying to enter pre mode, run ${color.cyan("changeset pre enter")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  }
}
