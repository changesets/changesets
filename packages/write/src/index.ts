import type { Changeset, Config } from "@changesets/types";
import fs from "node:fs/promises";
import { humanId } from "human-id";
import { formatly, resolveFormatter } from "formatly";
import path from "path";

type Formatter = (filePath: string) => Promise<void>;

async function getFormatter(
  config: Config["format"],
  cwd: string
): Promise<Formatter> {
  if (config === false) return async () => {};

  const formatter =
    config === "auto" ? (await resolveFormatter(cwd))?.name : config;
  if (!formatter) return async () => {};

  return async (filePath: string) => {
    await formatly([filePath], { cwd, formatter });
  };
}

async function writeChangeset(
  changeset: Changeset,
  cwd: string,
  options?: Pick<Config, "format">
): Promise<string> {
  const { summary, releases } = changeset;

  const changesetBase = path.resolve(cwd, ".changeset");

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  const changesetID = humanId({
    separator: "-",
    capitalize: false,
  });

  const formatter = await getFormatter(options?.format ?? "auto", cwd);

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

export default writeChangeset;
