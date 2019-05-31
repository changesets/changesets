import fs from "fs-extra";
import path from "path";
import prettier from "prettier";
import pkgDir from "pkg-dir";
import humanId from "human-id";

import { removeEmptyFolders } from "../../utils/removeFolders";
import getChangesetBase from "../../utils/getChangesetBase";

async function writeChangeset(changesetData, opts) {
  const cwd = opts.cwd || process.cwd();

  const { summary, ...jsonData } = changesetData;
  const dir = await pkgDir(cwd);

  const changesetBase = await getChangesetBase(cwd);

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  const changesetID = humanId({
    separator: "-",
    capitalize: false
  });

  const prettierConfig = await prettier.resolveConfig(dir);

  const newFolderPath = path.resolve(changesetBase, changesetID);
  if (fs.existsSync(newFolderPath)) {
    throw new Error(
      `A changeset with the unique ID ${changesetID} already exists`
    );
  }

  removeEmptyFolders(changesetBase);
  fs.mkdirSync(newFolderPath);

  // the changeset is divided into two parts, a .md and a .json file.
  // the .md file represents what will be written into the changelogs for packages
  // the .json file includes metadata about the changeset.
  fs.writeFileSync(path.resolve(newFolderPath, "changes.md"), summary);

  fs.writeFileSync(
    path.resolve(newFolderPath, "changes.json"),
    prettier.format(JSON.stringify(jsonData), {
      ...prettierConfig,
      parser: "json"
    })
  );
  return changesetID;
}

export default writeChangeset;
