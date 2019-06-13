import fs from "fs-extra";
import path from "path";
import parse from "@changesets/parse";

import * as git from "./git";
import { Changeset } from "./types";

export default async function getChangesets(
  cwd: string,
  sinceMasterOnly: boolean
): Promise<Array<Changeset>> {
  let changesetBase = path.join(cwd, ".changeset");

  if (!fs.existsSync(changesetBase)) {
    throw new Error("There is no .changeset directory in this project");
  }

  let files = fs.readdirSync(changesetBase);

  let changesets = files.filter(
    file => file.endsWith(".md") && file !== "README.md"
  );

  if (sinceMasterOnly) {
    const newChangesets = await git.getChangedChangesetFilesSinceMaster(
      changesetBase
    );
    const newHahses = newChangesets.map(c => c.split("/")[1]);

    changesets = changesets.filter(dir => newHahses.includes(dir));
  }

  const changesetContents = changesets.map(async file => {
    const changeset = await fs.readFile(path.join(changesetBase, file));

    return parse(changeset);
  });
  return Promise.all(changesetContents);
}
