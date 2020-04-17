import fs from "fs-extra";
import path from "path";
import parse from "@changesets/parse";
import {
  NewChangeset,
  MixedChangesets,
  GlobalChangeset
} from "@changesets/types";
import * as git from "@changesets/git";
import getOldChangesetsAndWarn from "./legacy";

async function filterChangesetsSinceRef(
  changesets: Array<string>,
  changesetBase: string,
  sinceRef: string
) {
  const newChangesets = await git.getChangedChangesetFilesSinceRef({
    cwd: changesetBase,
    ref: sinceRef
  });
  const newHahses = newChangesets.map(c => c.split("/")[1]);

  return changesets.filter(dir => newHahses.includes(dir));
}

export default async function getChangesets(
  cwd: string,
  sinceRef?: string
): Promise<MixedChangesets> {
  let changesetBase = path.join(cwd, ".changeset");
  let contents: string[];
  try {
    contents = await fs.readdir(changesetBase);
  } catch (err) {
    if (err.code === "ENOENT") {
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

  let oldChangesetsPromise = getOldChangesetsAndWarn(changesetBase, contents);

  let changesets = contents.filter(
    file => file.endsWith(".md") && file !== "README.md"
  );

  const changesetContents = changesets.map(async file => {
    const changeset = await fs.readFile(
      path.join(changesetBase, file),
      "utf-8"
    );

    return { ...parse(changeset), id: file.replace(".md", "") };
  });

  let allChangesets = [
    ...(await oldChangesetsPromise),
    ...(await Promise.all(changesetContents))
  ];

  let globalchangesets: GlobalChangeset[] = [];
  let nonGlobalChangesets: NewChangeset[] = [];

  for (let ch of allChangesets) {
    if ((ch as GlobalChangeset).name || ch.id === "aaa-global-changeset") {
      globalchangesets.push(ch as GlobalChangeset);
    } else {
      nonGlobalChangesets.push(ch as NewChangeset);
    }
  }

  if (globalchangesets.length > 1) {
    console.error(
      "Somehow we have two global changesets - since we can only do one global release at a time, this will cause things to break"
    );
    console.error(
      `We recommend looking at "aaa-global-changeset.md" or searching your changesets for a release of ""@changesets/secret-global-release""`
    );
    throw new Error("Multiple global changesets");
  }

  // @ts-ignore
  return globalchangesets[0]
    ? [globalchangesets[0], ...nonGlobalChangesets]
    : nonGlobalChangesets;
}

export function separateChangesets(
  changesets: MixedChangesets
): {
  changesets: NewChangeset[];
  globalChangeset: GlobalChangeset | undefined;
} {
  let [possibleGlobalChangeset, ...otherChangesets] = changesets;

  if (!possibleGlobalChangeset) {
    return {
      changesets: [],
      globalChangeset: undefined
    };
  }

  if (possibleGlobalChangeset.id === "aaa-global-changeset") {
    return {
      changesets: otherChangesets,
      globalChangeset: possibleGlobalChangeset as GlobalChangeset
    };
  }

  return {
    changesets: [possibleGlobalChangeset as NewChangeset, ...otherChangesets],
    globalChangeset: undefined
  };
}
