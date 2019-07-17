import fs from "fs-extra";
import path from "path";
import parse from "@changesets/parse";
import { NewChangeset } from "@changesets/types";
import * as git from "@changesets/git";

async function filterChangetsSinceMaster(
  changesets: Array<string>,
  changesetBase: string
) {
  const newChangesets = await git.getChangedChangesetFilesSinceMaster(
    changesetBase
  );

  const newHahses = newChangesets.map(c => c.split("/")[1]);

  return changesets.filter(dir => newHahses.includes(dir));
}

export default async function getChangesets(
  cwd: string,
  sinceMasterOnly?: boolean
): Promise<Array<NewChangeset>> {
  let changesetBase = path.join(cwd, ".changeset");

  if (!fs.existsSync(changesetBase)) {
    throw new Error("There is no .changeset directory in this project");
  }

  let files = fs.readdirSync(changesetBase);

  let changesets = files.filter(
    file => file.endsWith(".md") && file !== "README.md"
  );

  if (sinceMasterOnly) {
    changesets = await filterChangetsSinceMaster(changesets, changesetBase);
  }

  const changesetContents = changesets.map(async file => {
    const changeset = await fs.readFile(
      path.join(changesetBase, file),
      "utf-8"
    );

    return { ...parse(changeset), id: file.replace(".md", "") };
  });
  return Promise.all(changesetContents);
}
