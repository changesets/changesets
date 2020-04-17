import path from "path";
import fs from "fs-extra";
// import chalk from "chalk";

import { error, log } from "@changesets/logger";

// const { green, yellow, red, bold, blue, cyan } = chalk;

import * as cli from "../../utils/cli-utilities";

const globalChangsetId = "aaa-global-changeset.md";

export default async function addGlobalChangeset(cwd: string) {
  let globalChangesetPath = path.join(cwd, ".changeset", globalChangsetId);
  let globalChangesetContent;

  try {
    globalChangesetContent = await fs.readFile(globalChangesetPath);

    error("There is already a global changeset present!");
    error(
      "If you want to add more details, or change its name, go to .changeset/aaa-global-changeset.md"
    );
    error(
      "If you think it exists in error, delete .changeset/aaa-global-changeset.md"
    );
  } catch (e) {
    log(
      "It looks like you're adding a global changeset - this will name the next release, and create repository-wide release notes"
    );
    log(
      "What should this release be named (please use a valid npm tag as the name)"
    );

    let name = await cli.askQuestion("Name");

    log(
      "Please enter a summary for this change (this will be at the top of the global release notes)"
    );

    let summary = await cli.askQuestion("Summary");

    globalChangesetContent = `---
"@changesets/secret-global-release": "${name}"
---

${summary}`;

    await fs.writeFile(globalChangesetPath, globalChangesetContent);
  }
}
