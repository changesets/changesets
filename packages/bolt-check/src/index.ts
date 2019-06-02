import meow from "meow";
import boltCheck from "./bolt-check";

const { flags } = meow(
  `
    Usage
      $ bolt-check
        Performs the bolt-check action. See readme for full details.
        Will exit with code 1 if errors are found.
    Options
      --cwd="some/path"
        Provie a custom current working directory from which to run.
      --fix
        Automatically fixes (most) errors we detect.
      --silent
        Do not show any console warnings.

    `,
  {
    flags: {
      cwd: {
        type: "string",
        default: process.cwd()
      },
      fix: {
        type: "boolean"
      },
      silent: {
        type: "boolean"
      }
    }
  }
);

(async () => {
  // @ts-ignore
  boltCheck(flags);
})();
