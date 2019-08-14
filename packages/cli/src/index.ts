import meow from "meow";

import logger from "./utils/logger";

import init from "./commands/init";
import add from "./commands/add";
import version from "./commands/version";
import publish from "./commands/publish";
import status from "./commands/status";
import { ExitError } from "./utils/errors";
import { CliOptions } from "./types";

import { read } from "@changesets/config";
import getWorkspaces from "get-workspaces";

const { input, flags } = meow(
  `
  Usage
    $ changesets [command]
  Commands
    init
    add [--commit]
    version [--commit --changelog=path.js --skip-ci]
    publish [--public --otp=code]
    status [--since-master --verbose --output=JSON_FILE.json]
  `,
  {
    flags: {
      commit: {
        type: "boolean",
        // Command line options need to be undefined, otherwise their
        // default value overrides the user's provided config in their
        // config file
        default: undefined
      },
      changelog: {
        type: "string",
        default: undefined
      },
      skipCI: {
        type: "boolean",
        default: undefined
      },
      access: {
        type: "string",
        default: undefined
      },
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

  const config = await read(cwd, workspaces);

  if (input.length < 1) {
    await add(cwd, config);
  } else if (input.length > 1) {
    logger.error(
      "Too many arguments passed to changesets - we only accept the command name as an argument"
    );
  } else {
    const {
      commit,
      changelog,
      skipCI,
      access,
      sinceMaster,
      verbose,
      output,
      otp
    }: CliOptions = flags;

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
          if (commit !== undefined) {
            config.commit = commit;
          }
          await add(cwd, config);
          return;
        }
        case "version": {
          // We only assign them to this
          // object as and when they exist.
          if (changelog !== undefined) {
            config.changelog = [changelog, null];
          }
          if (commit !== undefined) {
            config.commit = commit;
          }
          if (skipCI !== undefined) {
            config.commit = "skipCI";
          }

          await version(config);
          return;
        }
        case "publish": {
          if (access !== undefined) {
            // This exists as
            config.access = access;
          }
          config.otp = otp;
          await publish(config);
          return;
        }
        case "bump": {
          logger.error(
            'In version 2 of changesets, "bump" has been renamed to "version" - see our changelog for an explanation'
          );
          logger.error(
            "To fix this, use `changeset version` instead, and update any scripts that use changesets"
          );
          throw new Error("old command used");
        }
        case "release": {
          logger.error(
            'In version 2 of changesets, "release" has been renamed to "publish" - see our changelog for an explanation'
          );
          logger.error(
            "To fix this, use `changeset publish` instead, and update any scripts that use changesets"
          );
          throw new Error("old command used");
        }
        case "status": {
          await status(cwd, { sinceMaster, verbose, output });
          return;
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
