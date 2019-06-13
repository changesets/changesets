import fs from "fs-extra";
import path from "path";
import prettier from "prettier";
import pkgDir from "pkg-dir";
import humanId from "human-id";

import getChangesetBase from "../../utils/getChangesetBase";

// Note with getChangeset - we put the name in quotes as it stops errors
// on scoped package names
const getChangeset = (releases, summary) => `---
${releases.map(({ name, type }) => `"${name}": ${type}`).join("\n")}
---

${summary}`;

async function newwriteChangeset(changesetData, opts) {
  const cwd = opts.cwd || process.cwd();

  const { summary, releases } = changesetData;
  const dir = await pkgDir(cwd);

  const changesetBase = await getChangesetBase(cwd);

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  const changesetID = humanId({
    separator: "-",
    capitalize: false
  });

  const prettierConfig = await prettier.resolveConfig(dir);

  const filePath = path.resolve(changesetBase, `${changesetID}.md`);
  if (fs.existsSync(filePath)) {
    throw new Error(
      `A changeset with the ID ${changesetID} already exists - this is unlikely, and will work if you try again 😅`
    );
  }

  fs.writeFileSync(
    filePath,
    prettier.format(getChangeset(releases, summary), {
      ...prettierConfig,
      parser: "markdown"
    })
  );

  return changesetID;
}

export default newwriteChangeset;
