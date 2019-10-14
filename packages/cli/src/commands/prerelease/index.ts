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
  { tag }: { tag?: string },
  config: Config
) {
  let workspaces = await getWorkspaces({ cwd });
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState = await readPreState(cwd);
  if (preState === undefined) {
    if (!tag) {
      logger.error(
        `Please pass a tag to the prerelease command, for example \`next\``
      );
      throw new ExitError(1);
    }
    let newPreState: PreState = {
      mode: "pre",
      tag,
      packages: {},
      version: -1
    };
    for (let workspace of workspaces) {
      newPreState.packages[workspace.name] = {
        initialVersion: workspace.config.version,
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
    preState.mode = "exit";
    await fs.writeFile(preStatePath, JSON.stringify(preState, null, 2) + "\n");
  }
}
