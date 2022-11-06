import fs from "fs-extra";
import path from "path";
import parse from "@changesets/parse";
import { NewChangeset } from "@changesets/types";
import * as git from "@changesets/git";
import getOldChangesetsAndWarn from "./legacy";

async function filterChangesetsSinceRef(
  changesets: Array<string>,
  changesetBase: string,
  sinceRef: string
) {
  const newChangesets = await git.getChangedChangesetFilesSinceRef({
    cwd: changesetBase,
    ref: sinceRef,
  });
  const newHashes = newChangesets.map((c) => c.split("/")[1]);

  return changesets.filter((dir) => newHashes.includes(dir));
}

export default async function getChangesets(
  cwd: string,
  sinceRef?: string
): Promise<Array<NewChangeset>> {
  let changesetBase = path.join(cwd, ".changeset");
  let contents: string[];

  console.debug(3, sinceRef);

  try {
    contents = await fs.readdir(changesetBase);
  } catch (err) {
    if ((err as any).code === "ENOENT") {
      throw new Error("There is no .changeset directory in this project");
    }
    throw err;
  }

  console.debug(31, contents);

  // TODO: currently unused
  if (sinceRef !== undefined) {
    contents = await filterChangesetsSinceRef(
      contents,
      changesetBase,
      sinceRef
    );
  }

  // TODO: currently unused
  let oldChangesetsPromise = getOldChangesetsAndWarn(changesetBase, contents);

  let changesets = contents.filter(
    (file) =>
      !file.startsWith(".") && file.endsWith(".md") && file !== "README.md"
  );

  console.debug(32, changesets);

  const changesetContents = changesets.map(async (file) => {
    const changeset = await fs.readFile(
      path.join(changesetBase, file),
      "utf-8"
    );

    return { ...parse(changeset), id: file.replace(".md", "") };
  });

  const a = [
    ...(await oldChangesetsPromise),
    ...(await Promise.all(changesetContents)),
  ];

  return a;
}
