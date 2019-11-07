import path from "path";
import fs from "fs-extra";
import chalk from "chalk";

import { defaultWrittenConfig } from "@changesets/config";
import { info, log, warn, error } from "@changesets/logger";

const pkgPath = path.dirname(require.resolve("@changesets/cli/package.json"));

export default async function init(cwd: string) {
  const changesetBase = path.resolve(cwd, ".changeset");

  if (fs.existsSync(changesetBase)) {
    if (!fs.existsSync(path.join(changesetBase, "config.json"))) {
      if (fs.existsSync(path.join(changesetBase, "config.js"))) {
        error(
          "It looks like you're using the version 1 `.changeset/config.js` file"
        );
        error(
          "The format of the config object has significantly changed in v2 as well"
        );
        error(
          " - we thoroughly recommend looking at the changelog for this package for what has changed"
        );
        error(
          "Changesets will write the defaults for the new config, remember to transfer your options into the new config at `.changeset/config.json`"
        );
      } else {
        error("It looks like you don't have a config file");
        info(
          "The default config file will be written at `.changeset/config.json`"
        );
      }
      await fs.writeFile(
        path.resolve(changesetBase, "config.json"),
        JSON.stringify(defaultWrittenConfig, null, 2)
      );
    } else {
      warn(
        "It looks like you already have changesets initialized. You should be able to run changeset commands no problems."
      );
    }
  } else {
    await fs.copy(path.resolve(pkgPath, "./default-files"), changesetBase);
    await fs.writeFile(
      path.resolve(changesetBase, "config.json"),
      JSON.stringify(defaultWrittenConfig, null, 2)
    );

    log(
      chalk`Thanks for choosing {green changesets} to help manage your versioning and publishing\n`
    );
    log("You should be set up to start using changesets now!\n");

    info(
      "We have added a `.changeset` folder, and a couple of files to help you out:"
    );
    info(
      chalk`- {blue .changeset/README.md} contains information about using changesets`
    );
    info(chalk`- {blue .changeset/config.json} is our default config`);
  }
}
