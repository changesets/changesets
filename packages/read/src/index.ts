import fs from "node:fs/promises";
import path from "node:path";
import * as git from "@changesets/git";
import { parseChangesetFile } from "@changesets/parse";
import type { NewChangeset } from "@changesets/types";

// Files in `.changeset` that should not be considered as changesets. We may
// revisit this if it becomes difficult to maintain the common list of files.
const ignoredMdFiles = [/^README\.md$/i, "AGENTS.md", "CLAUDE.md", "GEMINI.md"];

async function filterChangesetsSinceRef(
  changesets: Array<string>,
  changesetBase: string,
  sinceRef: string,
) {
  const newChangesets = await git.getChangedChangesetFilesSinceRef({
    cwd: changesetBase,
    ref: sinceRef,
  });
  const newHashes = newChangesets.map((c) => c.split("/").pop());

  return changesets.filter((dir) => newHashes.includes(dir));
}

export async function readChangesets(
  rootDir: string,
  sinceRef?: string,
): Promise<Array<NewChangeset>> {
  const changesetBase = path.join(rootDir, ".changeset");
  let contents: string[];
  try {
    contents = await fs.readdir(changesetBase);
  } catch (err) {
    if ((err as { code: string }).code === "ENOENT") {
      throw new Error("There is no .changeset directory in this project", {
        cause: err,
      });
    }
    throw err;
  }

  if (sinceRef != null) {
    contents = await filterChangesetsSinceRef(
      contents,
      changesetBase,
      sinceRef,
    );
  }

  const changesets = contents.filter(
    (file) =>
      !file.startsWith(".") &&
      file.endsWith(".md") &&
      !ignoredMdFiles.some((pattern) =>
        typeof pattern === "string" ? pattern === file : pattern.test(file),
      ),
  );

  const changesetContents = changesets.map(async (file) => {
    const changeset = await fs.readFile(path.join(changesetBase, file), "utf8");

    return { ...parseChangesetFile(changeset), id: file.replace(".md", "") };
  });
  return await Promise.all(changesetContents);
}

/** @deprecated Use named export `readChangesets` instead */
const readChangesetsDefault = readChangesets;
export default readChangesetsDefault;
