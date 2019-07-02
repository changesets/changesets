import getWorkspaces from "get-workspaces";
import semver from "semver";
import path from "path";
import fs from "fs-extra";
import { workspaceConfig, ErrorObj, Config } from "../types";
import { DEPENDENCY_TYPES } from "../constants";

const flatten = (workspace: workspaceConfig) => {
  let flatDeps = new Map();

  for (let depType of DEPENDENCY_TYPES) {
    let deps = workspace[depType];
    if (!deps || typeof deps !== "object") continue;
    for (let [name, version] of Object.entries(deps)) {
      if (!flatDeps.has(name)) {
        flatDeps.set(name, version);
      }
    }
  }
  return flatDeps;
};

export default async function check(config: Config) {
  let errors: ErrorObj[] = [];

  let workspaces = await getWorkspaces(config);

  if (!workspaces) {
    console.error("could not resolve workspaces to check");
    throw new Error("could not resolve workspaces to check");
  }

  let workspaceVersions = new Map();
  let rootPkgJson: workspaceConfig = JSON.parse(
    await fs.readFile(path.resolve(config.cwd, "package.json"), "utf-8")
  );
  let rootDeps = new Map();

  for (let depType of DEPENDENCY_TYPES) {
    let deps = rootPkgJson[depType];
    if (!deps || typeof deps !== "object") continue;
    if (depType === "devDependencies") {
      errors.push({
        type: "rootContainsDevDeps"
      });
    }
    for (let [name, version] of Object.entries(deps)) {
      if (!rootDeps.has(name)) {
        rootDeps.set(name, version);
      }
    }
  }

  for (let workspace of workspaces) {
    workspaceVersions.set(workspace.config.name, workspace.config.version);
  }

  for (let workspace of workspaces) {
    let flatDeps = flatten(workspace.config);
    for (let [name, range] of flatDeps.entries()) {
      if (workspaceVersions.has(name)) {
        let currentVersion = workspaceVersions.get(name);
        if (!semver.satisfies(currentVersion, range)) {
          errors.push({
            type: "internalMismatch",
            pkgName: workspace.name,
            dependency: name,
            version: currentVersion
          });
        }
      } else {
        let rootVersion = rootDeps.get(name);
        if (!rootVersion) {
          errors.push({
            type: "missingDependency",
            pkgName: workspace.name,
            dependency: name,
            pkgVersion: range
          });
        } else if (rootVersion !== range) {
          errors.push({
            type: "externalMismatch",
            pkgName: workspace.name,
            pkgVersion: range,
            dependency: name,
            rootVersion
          });
        }
      }
    }
  }

  return errors;
}
