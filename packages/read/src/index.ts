import fs from "node:fs/promises";
import path from "path";
import parse from "@changesets/parse";
import type { NewChangeset } from "@changesets/types";
import * as git from "@changesets/git";

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
  try {
    contents = await fs.readdir(changesetBase);
  } catch (err) {
    if ((err as any).code === "ENOENT") {
      throw new Error("There is no .changeset directory in this project");
    }
    throw err;
  }

  if (sinceRef !== undefined) {
    contents = await filterChangesetsSinceRef(
      contents,
      changesetBase,
      sinceRef
    );
  }

  let changesets = contents.filter(
    (file) =>
      !file.startsWith(".") &&
      file.endsWith(".md") &&
      !/^README\.md$/i.test(file)
  );

  const changesetContents = changesets.map(async (file) => {
    const changeset = await fs.readFile(path.join(changesetBase, file), "utf8");

    return { ...parse(changeset), id: file.replace(".md", "") };
  });
  return await Promise.all(changesetContents);
}
