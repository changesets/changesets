// This is a modified version of the package-getting in bolt

import fs from "fs-extra";
import path from "path";
import globby from "globby";

export default async function getWorkspaces({ cwd }) {
  let workspaces = [];
  const pkg = await fs
    .readFile(path.join(cwd, "package.json"), "utf-8")
    .then(JSON.parse);
  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      workspaces = pkg.workspaces;
    } else if (pkg.workspaces.package) {
      workspaces = pkg.workspaces.package;
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    workspaces = pkg.bolt.workspaces;
  }
  // TODO: This is our crux point for supporting a single-package repo
  const folders = await globby(workspaces, {
    cwd,
    onlyDirectories: true,
    absolute: true,
    expandDirectories: false
  });

  const results = await Promise.all(
    folders
      .filter(dir => fs.existsSync(path.join(dir, "package.json")))
      .map(async dir =>
        fs.readFile(path.join(dir, "package.json")).then(contents => {
          const config = JSON.parse(contents);
          return { config, name: config.name, dir };
        })
      )
  );
  return results;
}
