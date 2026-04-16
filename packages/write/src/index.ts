import { formatMarkdown, getMarkdownFormat } from "@changesets/format";
import { Changeset, MarkdownFormat } from "@changesets/types";
import fs from "fs-extra";
import humanId from "human-id";
import path from "path";

async function writeChangeset(
  changeset: Changeset,
  rootDir: string,
  options?: { format?: MarkdownFormat; prettier?: boolean }
): Promise<string> {
  const { summary, releases } = changeset;

  const changesetBase = path.resolve(rootDir, ".changeset");

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  const changesetID = humanId({
    separator: "-",
    capitalize: false,
  });

  const newChangesetPath = path.resolve(changesetBase, `${changesetID}.md`);

  // NOTE: The quotation marks in here are really important even though they are
  // not spec for yaml. This is because package names can contain special
  // characters that will otherwise break the parsing step
  const changesetContents = `---
${releases.map((release) => `"${release.name}": ${release.type}`).join("\n")}
---

${summary}
  `;

  await fs.outputFile(
    newChangesetPath,
    await formatMarkdown(
      changesetContents,
      newChangesetPath,
      rootDir,
      getMarkdownFormat(options)
    )
  );

  return changesetID;
}

export default writeChangeset;
