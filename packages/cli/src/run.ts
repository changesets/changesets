import fs from "node:fs/promises";
import path from "node:path";
import { read } from "@changesets/config";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import pc from "picocolors";
import { COMMAND_HELP } from "./help.ts";
import type { CliOptions } from "./types.ts";

function validateCommandFlags(
  command: keyof typeof COMMAND_HELP,
  flags: Record<string, unknown>,
) {
  const unknownFlags = Object.keys(flags);

  if (unknownFlags.length > 0) {
    log.error(
      `
Unknown flag${unknownFlags.length > 1 ? "s" : ""} for ${pc.cyan(command)}: ${unknownFlags.map((flag) => `--${flag}`).join(", ")}
Usage: changeset ${COMMAND_HELP[command]}
      `.trim(),
    );
    throw new ExitError(1);
  }
}

export async function run(
  input: string[],
  flags: { [name: string]: any },
  cwd: string,
) {
  const packages = await getPackages(cwd);

  if (input[0] === "init") {
    validateCommandFlags("init", flags);
    const { init } = await import("./commands/init/index.ts");
    await init(packages.rootDir);
    return;
  }

  try {
    await fs.access(path.resolve(packages.rootDir, ".changeset"));
  } catch {
    log.error(
      `
There is no .changeset folder.
If this is the first time ${pc.green("Changesets")} have been used in this project, run ${pc.cyan("changeset init")} to get set up.
If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration.
      `.trim(),
    );
    throw new ExitError(1);
  }

  const config = await read(packages.rootDir, packages);

  if (input.length < 1) {
    const { empty, open, since, message, ...rest }: CliOptions = flags;
    validateCommandFlags("add", rest);
    const { add } = await import("./commands/add/index.ts");
    await add(packages.rootDir, { empty, open, since, message }, config);
  } else if (input[0] !== "pre" && input.length > 1) {
    log.error(
      "Too many arguments passed to changesets - we only accept the command name as an argument",
    );
  } else {
    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.

    switch (input[0]) {
      case "add": {
        const { empty, open, since, message, ...rest }: CliOptions = flags;
        validateCommandFlags("add", rest);
        const { add } = await import("./commands/add/index.ts");
        await add(packages.rootDir, { empty, open, since, message }, config);
        return;
      }
      case "version": {
        const {
          ignore,
          snapshot,
          snapshotPrereleaseTemplate,
          ...rest
        }: CliOptions = flags;
        validateCommandFlags("version", rest);
        let ignoreArrayFromCmd: undefined | string[];
        if (typeof ignore === "string") {
          ignoreArrayFromCmd = [ignore];
        } else {
          // undefined or an array
          ignoreArrayFromCmd = ignore;
        }
        const { version } = await import("./commands/version/index.ts");
        await version(
          packages.rootDir,
          {
            ignore: ignoreArrayFromCmd,
            snapshot,
            snapshotPrereleaseTemplate,
          },
          config,
        );
        return;
      }
      case "publish": {
        const { otp, tag, gitTag, ...rest }: CliOptions = flags;
        validateCommandFlags("publish", rest);
        const { publish } = await import("./commands/publish/index.ts");
        await publish(packages.rootDir, { otp, tag, gitTag }, config);
        return;
      }
      case "status": {
        const { since, verbose, output, ...rest }: CliOptions = flags;
        validateCommandFlags("status", rest);
        const { status } = await import("./commands/status/index.ts");
        await status(packages.rootDir, { since, verbose, output }, config);
        return;
      }
      case "tag": {
        validateCommandFlags("tag", flags);
        const { tag } = await import("./commands/tag/index.ts");
        await tag(packages.rootDir, config);
        return;
      }
      case "pre": {
        validateCommandFlags("pre", flags);
        const command = input[1];
        if (command !== "enter" && command !== "exit") {
          log.error(
            `${pc.cyan("enter")}, ${pc.cyan("exit")} or ${pc.cyan("snapshot")} must be passed after prerelease`,
          );
          throw new ExitError(1);
        }
        const tag = input[2];
        if (command === "enter" && typeof tag !== "string") {
          log.error(`A tag must be passed when using prerelease enter`);
          throw new ExitError(1);
        }
        const { pre } = await import("./commands/pre/index.ts");
        await pre(packages.rootDir, { command, tag });
        return;
      }
      case "bump": {
        log.error(
          `
In version 2 of changesets, ${pc.red("bump")} has been renamed to ${pc.cyan("version")} - see our changelog for an explanation
To fix this, use ${pc.cyan("changeset version")} instead, and update any scripts that use changesets
          `.trim(),
        );
        throw new ExitError(1);
      }
      case "release": {
        log.error(
          `
In version 2 of changesets, ${pc.red("release")} has been renamed to ${pc.cyan("publish")} - see our changelog for an explanation
To fix this, use ${pc.cyan("changeset publish")} instead, and update any scripts that use changesets
          `.trim(),
        );
        throw new ExitError(1);
      }
      default: {
        log.error(`Unknown command: ${pc.red(input[0])}`);
        throw new ExitError(1);
      }
    }
  }
}
