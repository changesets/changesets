import fs from "node:fs/promises";
import path from "node:path";
import { detect as detectFormatter, format } from "@changesets/format";
import type { Changeset, Config } from "@changesets/types";
import { humanId } from "human-id";
import * as yaml from "yaml";

async function getFormatter(
  config: Config["format"],
  cwd: string,
): Promise<(patterns: string[]) => Promise<void>> {
  if (config === false) return async () => {};

  const formatter =
    config === "auto"
      ? await detectFormatter({
          cwd,
        })
      : config;
  if (!formatter) return async () => {};

  return async (patterns: string[]) => {
    await format(patterns, { cwd, formatter });
  };
}

export async function writeChangeset(
  { summary, releases, metadata }: Changeset,
  rootDir: string,
  options?: { format?: Config["format"] },
): Promise<string> {
  const changesetBase = path.resolve(rootDir, ".changeset");

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  const changesetID = humanId({
    separator: "-",
    capitalize: false,
  });

  const formatter = await getFormatter(options?.format ?? "auto", rootDir);
  const newChangesetPath = path.resolve(changesetBase, `${changesetID}.md`);

  const packagesFrontmatter = Object.fromEntries(
    releases.map((release) => [release.name, release.type]),
  );
  const frontmatter = {
    ...packagesFrontmatter,
    _: metadata,
  };
  const frontmatterString = yaml.stringify(frontmatter, {
    singleQuote: false,
    aliasDuplicateObjects: false,
  });

  const changesetContents = `
---
${frontmatterString}
---

${summary}
`.trimStart();

  await fs.mkdir(path.dirname(newChangesetPath), { recursive: true });
  await fs.writeFile(newChangesetPath, changesetContents);
  await formatter([newChangesetPath]);

  return changesetID;
}

/** @deprecated Use named export `writeChangeset` instead */
const writeChangesetDefault = writeChangeset;
export default writeChangesetDefault;
