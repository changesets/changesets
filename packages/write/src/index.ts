import type { Changeset } from "@changesets/types";
import fs from "node:fs/promises";
import { humanId } from "human-id";
import path from "path";

async function importPrettier() {
  try {
    return await import("prettier");
  } catch (err) {
    if ((err as any).code === "MODULE_NOT_FOUND") {
      throw new Error(
        "The `prettier` option is enabled but Prettier was not found in your project. Please install Prettier in your project or disable the option.",
        { cause: err },
      );
    }

    throw err;
  }
}

async function writeChangeset(
  changeset: Changeset,
  cwd: string,
  options?: { prettier?: boolean },
): Promise<string> {
  const { summary, releases } = changeset;

  const changesetBase = path.resolve(cwd, ".changeset");

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  const changesetID = humanId({
    separator: "-",
    capitalize: false,
  });

  const prettier = options?.prettier ? await importPrettier() : undefined;
  const newChangesetPath = path.resolve(changesetBase, `${changesetID}.md`);

  // NOTE: The quotation marks in here are really important even though they are
  // not spec for yaml. This is because package names can contain special
  // characters that will otherwise break the parsing step
  const changesetContents = `---
${releases.map((release) => `"${release.name}": ${release.type}`).join("\n")}
---

${summary}
  `;

  await fs.mkdir(path.dirname(newChangesetPath), { recursive: true });
  await fs.writeFile(
    newChangesetPath,
    prettier != null
      ? await prettier.format(changesetContents, {
          ...(await prettier.resolveConfig(newChangesetPath)),
          parser: "markdown",
        })
      : changesetContents,
  );

  return changesetID;
}

export default writeChangeset;
