#!/usr/bin/env node
import meow from "meow";

import logger from "./utils/logger";

import init from "./commands/init";
import add from "./commands/add";
import consume from "./commands/consume";
import release from "./commands/release";
import status from "./commands/status";

const { input, flags } = meow(
  `
  Usage
    $ changesets [command]
  Commands
    init
    add
    consume
    release
    status
  `,
  {
    flags: {
      commit: {
        type: "boolean"
      },
      updateChangelog: {
        type: "boolean",
        default: true
      },
      skipCI: {
        type: "boolean"
      },
      public: {
        type: "boolean"
      },
      sinceMaster: {
        type: "boolean"
      }
    }
  }
);

const cwd = process.cwd();

// TODO - run 'add' if no command is passed in
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
      sinceMaster
    } = flags;

    switch (input[0]) {
      case "init": {
        await init({ cwd });
        return;
      }
      case "add": {
        await add({ cwd, commit });
        return;
      }
      case "consume": {
        await consume({ cwd, updateChangelog, skipCI, commit });
        return;
      }
      case "release": {
        await release({ cwd, release, public: isPublic });
        return;
      }
      case "status": {
        await status({ cwd, sinceMaster });
        return;
      }
      default: {
        logger.error(`Invalid command ${input[0]} was provided`);
      }
    }
  }
})();
