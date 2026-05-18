import c from "@changesets/color";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
  ExitError,
} from "@changesets/errors";
import { exitPre, enterPre } from "@changesets/pre";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { ensureChangesetFolder } from "../shared.ts";

export type PreOptions = PreOptionsEnter | PreOptionsExit;

interface PreOptionsEnter extends PreOptionsBase {
  command: "enter";
  tag: string;
}

interface PreOptionsExit extends PreOptionsBase {
  command: "exit";
}

interface PreOptionsBase {
  cwd?: string;
}

export async function pre(options: PreOptions) {
  const cwd = options.cwd ?? process.cwd();
  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);

  if (options.command === "enter") {
    try {
      await enterPre(packages.rootDir, options.tag);
      log.success(
        `
Entered pre mode with tag ${c.green(options.tag)}!
Run ${c.cyan("changeset version")} to version packages with prerelease versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        log.error(
          `
${c.cyan("changeset pre enter")} cannot be run when in pre mode.
If you're trying to exit pre mode, run ${c.cyan("changeset pre exit")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  } else {
    try {
      await exitPre(packages.rootDir);
      log.success(
        `
Exited pre mode!
Run ${c.cyan("changeset version")} to version packages with normal versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        log.error(
          `
${c.cyan("changeset pre exit")} can only be run when in pre mode!
If you're trying to enter pre mode, run ${c.cyan("changeset pre enter")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  }
}
