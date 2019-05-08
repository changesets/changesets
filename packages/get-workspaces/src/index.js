// This is a modified version of the package-getting in bolt
// It supports yarn workspaces as well, and can fall back through
// several options

import fs from "fs-extra";
import path from "path";
import globby from "globby";

export default async function getWorkspaces(opts) {
  const cwd = opts.cwd || process.cwd();
  const tools = opts.tools || ["yarn", "bolt"]; // We also support root, but don't do it by default

  const pkg = await fs
    .readFile(path.join(cwd, "package.json"), "utf-8")
    .then(JSON.parse);

  let workspaces;

  if (tools.includes("yarn") && pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      workspaces = pkg.workspaces;
    } else if (pkg.workspaces.packages) {
      workspaces = pkg.workspaces.packages;
    }
  } else if (tools.includes("bolt") && pkg.bolt && pkg.bolt.workspaces) {
    workspaces = pkg.bolt.workspaces;
  }

  if (!workspaces) {
    if (tools.includes("root")) {
      return [{ config: pkg, dir: cwd, name: pkg.name }];
    }
    return null;
  }

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
