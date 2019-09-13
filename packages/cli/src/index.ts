import meow from "meow";
import { read } from "@changesets/config";
import { Config } from "@changesets/types";
import fs from "fs-extra";
import path from "path";
import getWorkspaces from "get-workspaces";

import logger from "./utils/logger";

import init from "./commands/init";
import add from "./commands/add";
import version from "./commands/version";
import publish from "./commands/publish";
import status from "./commands/status";
import { ExitError } from "./utils/errors";
import { CliOptions } from "./types";

const { input, flags } = meow(
  `
  Usage
    $ changesets [command]
  Commands
    init
    add
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
  let config: Config;
  try {
    config = await read(cwd, workspaces);
  } catch (e) {
    let oldConfigExists = await fs.pathExists(
      path.resolve(cwd, ".changeset/config.js")
    );
    if (oldConfigExists) {
      logger.error(
        "It looks like you're using the version 1 `.changeset/config.js` file"
      );
      logger.error(
        "You'll need to convert it to a `.changeset/config.json` file"
      );
      logger.error(
        "The format of the config object has significantly changed in v2 as well"
      );
      logger.error(
        " - we thoroughly recommend looking at the changelog for this package for what has changed"
      );
      process.exit(1);
    } else {
      throw e;
    }
  }

  if (input.length < 1) {
    // @ts-ignore if this is undefined, we have already exited
    await add(cwd, config);
  } else if (input.length > 1) {
    logger.error(
      "Too many arguments passed to changesets - we only accept the command name as an argument"
    );
  } else {
    const { sinceMaster, verbose, output, otp }: CliOptions = flags;
    const deadFlags = ["updateChangelog", "isPublic", "skipCI", "commit"];

    deadFlags.forEach(flag => {
      if (flags[flag]) {
        logger.error(
          `the flag ${flag} has been removed from changesets for version 2`
        );
        logger.error(`Please encode the desired value into your config`);
        logger.error(`See our changelog for more details`);
        throw new ExitError(1);
      }
    });

    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.

    try {
      switch (input[0]) {
        case "init": {
          await init(cwd);
          return;
        }
        case "add": {
          // @ts-ignore if this is undefined, we have already exited
          await add(cwd, config);
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
          logger.error(
            'In version 2 of changesets, "bump" has been renamed to "version" - see our changelog for an explanation'
          );
          logger.error(
            "To fix this, use `changeset version` instead, and update any scripts that use changesets"
          );
          throw new ExitError(1);
        }
        case "release": {
          logger.error(
            'In version 2 of changesets, "release" has been renamed to "publish" - see our changelog for an explanation'
          );
          logger.error(
            "To fix this, use `changeset publish` instead, and update any scripts that use changesets"
          );
          throw new ExitError(1);
        }
        default: {
          logger.error(`Invalid command ${input[0]} was provided`);
        }
      }
    } catch (err) {
      if (err instanceof ExitError) {
        return process.exit(err.code);
      }
      throw err;
    }
  }
})();
