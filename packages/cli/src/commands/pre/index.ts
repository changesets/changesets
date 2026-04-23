import {
  ExitError,
  PreEnterButInPreModeError,
  PreExitButNotInPreModeError,
} from "@changesets/errors";
import { enterPre, exitPre } from "@changesets/pre";
import { log, outro } from "@clack/prompts";
import { define } from "gunshi";
import pc from "picocolors";
import { defineWithContext } from "../../gunshi/context.ts";

export const preEnterCommand = defineWithContext({
  name: "enter",
  description: "Enter pre-release mode",
  examples: "changeset pre enter next",
  args: {
    tag: {
      type: "positional",
      required: true,
    },
  },
  run: async (ctx) => {
    const { tag } = ctx.values;

    if (tag == null || tag.length === 0) {
      log.error(
        `
You need to pass a tag name to enter pre mode.
${pc.cyan("changesets pre enter <tag>")}
        `.trim(),
      );
      throw new ExitError(1);
    }

    try {
      await enterPre(ctx.extensions.packages.rootDir, tag);
      log.success(
        `
Entered pre mode with tag ${pc.green(tag)}!
Run ${pc.cyan("changeset version")} to version packages with prerelease versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        log.error(
          `
${pc.cyan("changeset pre enter")} cannot be run when in pre mode.
If you're trying to exit pre mode, run ${pc.cyan("changeset pre exit")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  },
});

export const preExitCommand = defineWithContext({
  name: "exit",
  description: "Exit pre-release mode",
  run: async (ctx) => {
    try {
      await exitPre(ctx.extensions.packages.rootDir);
      outro(
        `
Exited pre mode!
   Run ${pc.cyan("changeset version")} to version packages with normal versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        log.error(
          `
${pc.cyan("changeset pre exit")} can only be run when in pre mode!
If you're trying to enter pre mode, run ${pc.cyan("changeset pre enter")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  },
});

export const preCommand = define({
  name: "pre",
  description: "Enter or exit pre-release mode",
  examples: `
changeset pre enter next
changeset pre exit
            `.trim(),
  subCommands: { enter: preEnterCommand, exit: preExitCommand },
});
