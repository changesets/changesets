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
        `Entered pre mode with tag ${c.green(options.tag)}!\n` +
          `Run ${c.cyan("changeset version")} to version packages with prerelease versions.`,
      );
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        log.error(
          `${c.cyan("changeset pre enter")} cannot be run when in pre mode.\n` +
            `If you're trying to exit pre mode, run ${c.cyan("changeset pre exit")}.`,
        );
        throw new ExitError(1);
      }
      throw err;
    }
  } else {
    try {
      await exitPre(packages.rootDir);
      log.success(
        `Exited pre mode!\n` +
          `Run ${c.cyan("changeset version")} to version packages with normal versions.\n\n` +
          `Please also review the changesets in the ${c.blue(".changeset/pre")} folder as ` +
          `they will be used as changelogs for the normal versions. Only include the changesets ` +
          `that will be relevant for the normal versions.`,
      );
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        log.error(
          `${c.cyan("changeset pre exit")} can only be run when in pre mode!\n` +
            `If you're trying to enter pre mode, run ${c.cyan("changeset pre enter")}.`,
        );
        throw new ExitError(1);
      }
      throw err;
    }
  }
}
