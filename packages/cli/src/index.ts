import meow from "meow";
import { read } from "@changesets/config";
import { ExitError } from "@changesets/errors";
import { error } from "@changesets/logger";
import { Config } from "@changesets/types";
import fs from "fs-extra";
import path from "path";
import getWorkspaces from "get-workspaces";

import init from "./commands/init";
import add from "./commands/add";
import version from "./commands/version";
import publish from "./commands/publish";
import status from "./commands/status";
import { CliOptions } from "./types";

const { input, flags } = meow(
  `
  Usage
    $ changesets [command]
  Commands
    init
    add [--empty]
    version
    publish [--otp=code]
    status [--since-master --verbose --output=JSON_FILE.json]
  `,
  {
    flags: {
      sinceMaster: {
        type: "boolean"
      },
      verbose: {
        type: "boolean",
        alias: "v"
      },
      output: {
        type: "string",
        alias: "o"
      },
      otp: {
        type: "string",
        default: undefined
      },
      empty: {
        type: "boolean"
      }
    }
  }
);

const cwd = process.cwd();

(async () => {
  const workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });

  if (!workspaces) {
    throw new Error(
      "We could not resolve workspaces - check you are running this command from the correct directory"
    );
  }
  if (input[0] === "init") {
    await init(cwd);
    return;
  }
  let config: Config;
  try {
    config = await read(cwd, workspaces);
  } catch (e) {
    let oldConfigExists = await fs.pathExists(
      path.resolve(cwd, ".changeset/config.js")
    );
    if (oldConfigExists) {
      error(
        "It looks like you're using the version 1 `.changeset/config.js` file"
      );
      error("You'll need to convert it to a `.changeset/config.json` file");
      error(
        "The format of the config object has significantly changed in v2 as well"
      );
      error(
        " - we thoroughly recommend looking at the changelog for this package for what has changed"
      );
      process.exit(1);
    } else {
      throw e;
    }
  }

  if (input.length < 1) {
    const { empty }: CliOptions = flags;
    // @ts-ignore if this is undefined, we have already exited
    await add(cwd, { empty }, config);
  } else if (input.length > 1) {
    error(
      "Too many arguments passed to changesets - we only accept the command name as an argument"
    );
  } else {
    const { sinceMaster, verbose, output, otp, empty }: CliOptions = flags;
    const deadFlags = ["updateChangelog", "isPublic", "skipCI", "commit"];

    deadFlags.forEach(flag => {
      if (flags[flag]) {
        error(
          `the flag ${flag} has been removed from changesets for version 2`
        );
        error(`Please encode the desired value into your config`);
        error(`See our changelog for more details`);
        throw new ExitError(1);
      }
    });

    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.

    switch (input[0]) {
      case "add": {
        // @ts-ignore if this is undefined, we have already exited
        await add(cwd, { empty }, config);
        return;
      }
      case "version": {
        // @ts-ignore if this is undefined, we have already exited
        await version(cwd, config);
        return;
      }
      case "publish": {
        // @ts-ignore if this is undefined, we have already exited
        await publish(cwd, { otp }, config);
        return;
      }
      case "status": {
        // @ts-ignore if this is undefined, we have already exited
        await status(cwd, { sinceMaster, verbose, output }, config);
        return;
      }
      case "bump": {
        error(
          'In version 2 of changesets, "bump" has been renamed to "version" - see our changelog for an explanation'
        );
        error(
          "To fix this, use `changeset version` instead, and update any scripts that use changesets"
        );
        throw new ExitError(1);
      }
      case "release": {
        error(
          'In version 2 of changesets, "release" has been renamed to "publish" - see our changelog for an explanation'
        );
        error(
          "To fix this, use `changeset publish` instead, and update any scripts that use changesets"
        );
        throw new ExitError(1);
      }
      default: {
        error(`Invalid command ${input[0]} was provided`);
        throw new ExitError(1);
      }
    }
  }
})().catch(err => {
  if (err instanceof ExitError) {
    return process.exit(err.code);
  }
  error(err);
  process.exit(1);
});
