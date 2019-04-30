import meow from "meow";

import init from "./commands/init";
import add from "./commands/add";
import consume from "./commands/consume";

const { input } = meow(
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
      rainbow: {
        type: "boolean",
        alias: "r"
      }
    }
  }
);

const cwd = process.cwd();

(async () => {
  switch (input[0]) {
    case "init": {
      await init({ cwd });
      return;
    }
    case "add": {
      await add({ cwd });
      return;
    }
    case "consume": {
      await consume({ cwd });
      return;
    }
    case "release": {
      console.error("the add command has not been implemented yet");
      return;
    }
    case "status": {
      console.error("the add command has not been implemented yet");
      return;
    }
    case "check": {
      console.error("the add command has not been implemented yet");
      return;
    }
    default: {
      throw new Error("No valid command was passed");
    }
  }
})();
