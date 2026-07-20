import fs from "node:fs/promises";
import path from "node:path";

/*
 * This file finds every changeset we currently have and tries to
 * find matching IDs in comments inside the v3 migration guide.
 * If any are missing, it will report them to help us to not miss any changes.
 */

const changesetIds = new Set(
  await Array.fromAsync(
    fs.glob("*.md", {
      exclude: ["README.md"],
      cwd: path.resolve(import.meta.dirname, "..", "..", ".changeset"),
    }),
    (p) => path.basename(p).slice(0, -3),
  ),
);

const commentRegex = /<!--\s+(.+?)\s+-->/g;

const migrationGuide = await fs.readFile(
  path.join(import.meta.dirname, "..", "guide", "migration", "v3.md"),
  "utf8",
);

const comments = [...(migrationGuide.matchAll(commentRegex) ?? [])];
const idsInComments = new Set(
  comments.flatMap((match) => match[1].replace(/,/g, "").split(" ")),
);

const diff = changesetIds.difference(idsInComments);
console.log(
  `❌ Found ${diff.size} changesets missing from the migration guide:`,
);
console.log(
  [...diff.values()]
    .slice(0, 10)
    .map((id) => ` - ${id}.md`)
    .join("\n"),
);
if (diff.size > 10) {
  console.log(`... and ${diff.size - 10} more`);
}
if (diff.size !== 0) process.exit(1);
