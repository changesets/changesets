import fs from "node:fs/promises";
import path from "node:path";
import { detect as detectFormatter, format } from "@changesets/format";
import type { Changeset, Config } from "@changesets/types";
import { humanId } from "human-id";

type Formatter = (filePath: string) => Promise<void>;

async function getFormatter(
  config: Config["format"],
  cwd: string,
): Promise<Formatter> {
  if (config === false) return async () => {};

  const formatter = config === "auto" ? await detectFormatter({ cwd }) : config;
  if (!formatter) return async () => {};

  return async (filePath: string) => {
    await format([filePath], { cwd, formatter });
  };
}

export async function writeChangeset(
  { summary, releases }: Changeset,
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

  // NOTE: The quotation marks in here are really important even though they are
  // not spec for yaml. This is because package names can contain special
  // characters that will otherwise break the parsing step
  const changesetContents = `---
${releases.map((release) => `"${release.name}": ${release.type}`).join("\n")}
---

${summary}
  `;

  await fs.mkdir(path.dirname(newChangesetPath), { recursive: true });
  await fs.writeFile(newChangesetPath, changesetContents);
  await formatter(newChangesetPath);

  return changesetID;
}

/** @deprecated Use named export `writeChangeset` instead */
const writeChangesetDefault = writeChangeset;
export default writeChangesetDefault;
