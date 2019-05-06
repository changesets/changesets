import meow from "meow";

import logger from "./utils/logger";

import init from "./commands/init";
import add from "./commands/add";
import bump from "./commands/bump";
import release from "./commands/release";
import status from "./commands/status";

const { input, flags } = meow(
  `
  Usage
    $ changesets [command]
  Commands
    init
    add [--commit]
    bump [--commit --update-changelog --skip-ci]
    release [--public]
    status [--since-master --verbose --output=JSON_FILE.json]
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
      },
      verbose: {
        type: "boolean",
        alias: "v"
      },
      output: {
        type: "string",
        alias: "o"
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
      output
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
      case "bump": {
        await bump({ cwd, updateChangelog, skipCI, commit });
        return;
      }
      case "release": {
        await release({ cwd, public: isPublic });
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
  }
})();
