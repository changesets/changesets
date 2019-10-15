import chalk from "chalk";
import table from "tty-table";
import fs from "fs-extra";
import path from "path";
import getReleasePlan from "@changesets/get-release-plan";
import {
  VersionType,
  Release,
  ComprehensiveRelease,
  Config,
  PreState
} from "@changesets/types";
import logger from "../../utils/logger";
import { ExitError } from "../../utils/errors";
import getWorkspaces from "../../utils/getWorkspaces";
import { readPreState } from "../../utils/read-pre-state";

export default async function prerelease(
  cwd: string,
  options:
    | { tag: string; command: "enter" }
    | { command: "exit"; tag?: string },
  config: Config
) {
  let workspaces = await getWorkspaces({ cwd });
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState = await readPreState(cwd);
  if (options.command === "enter") {
    if (preState !== undefined) {
      logger.error(
        "`changeset prerelease enter` cannot be run when in prerelease mode"
      );
      logger.info(
        "If you're trying to exit prerelease mode, run `changeset prerelease exit`"
      );
      throw new ExitError(1);
    }
    let newPreState: PreState = {
      mode: "pre",
      tag: options.tag,
      packages: {},
      version: -1
    };
    for (let workspace of workspaces) {
      // @ts-ignore
      newPreState.packages[workspace.name] = {
        initialVersion: workspace.config.version,
        highestVersionType: null,
        releaseLines: {
          major: [],
          minor: [],
          patch: []
        }
      };
    }
    await fs.writeFile(
      preStatePath,
      JSON.stringify(newPreState, null, 2) + "\n"
    );
  } else {
    if (preState === undefined) {
      logger.error(
        "`changeset prerelease exit` can only be run when in prerelease mode"
      );
      logger.info(
        "If you're trying to enter prerelease mode, run `changeset prerelease enter`"
      );
      throw new ExitError(1);
    }

    await fs.writeFile(
      preStatePath,
      JSON.stringify({ ...preState, mode: "exit" }, null, 2) + "\n"
    );
  }
}
