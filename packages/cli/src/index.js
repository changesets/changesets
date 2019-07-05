import meow from "meow";

import logger from "./utils/logger";

import init from "./commands/init";
import add from "./commands/add";
import bump from "./commands/bump";
import release from "./commands/release";
import status from "./commands/status";
import { ExitError } from "./utils/errors";

const { input, flags } = meow(
  `
  Usage
    $ changesets [command]
  Commands
    init
    add [--commit]
    bump [--commit --update-changelog --skip-ci]
    release [--public --otp=code]
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
      updateChangelog: {
        type: "boolean",
        default: undefined
      },
      skipCI: {
        type: "boolean",
        default: undefined
      },
      public: {
        type: "boolean",
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
  if (input.length < 1) {
    await add({ cwd });
  } else if (input.length > 1) {
    logger.error(
      "Too many arguments passed to changesets - we only accept the command name as an argument"
    );
  } else {
    const {
      commit,
      updateChangelog,
      skipCI,
      public: isPublic,
      sinceMaster,
      verbose,
      output,
      otp
    } = flags;

    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.
    const config = { cwd };
    try {
      switch (input[0]) {
        case "init": {
          await init({ cwd });
          return;
        }
        case "add": {
          if (commit !== undefined) {
            config.commit = commit;
          }
          await add(config);
          return;
        }
        case "bump": {
          // We only assign them to this
          // object as and when they exist.
          if (updateChangelog !== undefined) {
            config.updateChangelog = updateChangelog;
          }
          if (skipCI !== undefined) {
            config.skipCI = skipCI;
          }
          if (commit !== undefined) {
            config.commit = commit;
          }
          await bump(config);
          return;
        }
        case "release": {
          if (isPublic !== undefined) {
            // This exists as
            config.public = isPublic;
          }
          config.otp = otp;
          await release(config);
          return;
        }
        case "status": {
          await status({ cwd, sinceMaster, verbose, output });
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
