// @ts-ignore
import dotenv from "dotenv";

dotenv.config();

import Octokit from "@octokit/rest";
import nodePath from "path";
import micromatch from "micromatch";
import {
  Workspace,
  NewChangeset,
  PreState,
  VersionType
} from "@changesets/types";
import parseChangeset from "@changesets/parse";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { parse as parseConfig } from "@changesets/config";
import { getDependentsGraphFromWorkspaces } from "get-dependents-graph";

let depTypes = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

let octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

type Deps = { [pkgName: string]: string };

type Sha = string & { __sha: string };

type CachedWorkspace = {
  name: string;
  sha: Sha;
  version: string;
  dependencies?: Deps;
  devDependencies?: Deps;
  peerDependencies?: Deps;
  optionalDependencies?: Deps;
};

type WorkspacesCache = {
  [pkgPath: string]: CachedWorkspace;
};

let defaultCache: WorkspacesCache = {};

let getReleasePlanFromGitHub = async ({
  owner,
  repo,
  ref,
  cache = defaultCache,
  changedFiles
}: {
  owner: string;
  repo: string;
  ref: string;
  changedFiles: string[];
  cache?: WorkspacesCache;
}) => {
  let { ...workspaceCache } = cache;

  async function fetchJsonFile(path: string) {
    let output = await octokit.repos.getContents({
      owner,
      repo,
      path,
      ref
    });
    // @ts-ignore
    let buffer = Buffer.from(output.data.content, "base64");
    return JSON.parse(buffer.toString("utf8"));
  }

  // I'm assuming that a workspace will only be requested once per call to getReleasePlanFromGitHub
  // If that's an incorrect assumption, this should change
  async function getWorkspace(pkgPath: string, currentPkgSha: Sha) {
    let cachedWorkspace = workspaceCache[pkgPath];
    if (
      cachedWorkspace === undefined ||
      currentPkgSha !== cachedWorkspace.sha
    ) {
      let jsonContent = await fetchJsonFile(pkgPath + "/package.json");
      return {
        name: jsonContent.name,
        config: jsonContent,
        dir: pkgPath
      };
    }

    let name = cachedWorkspace.name;
    let workspace: Workspace = {
      name,
      dir: pkgPath,
      config: {
        name,
        version: cachedWorkspace.version
      }
    };
    for (let depType of depTypes) {
      if (cachedWorkspace[depType] !== undefined) {
        workspace.config[depType] = cachedWorkspace[depType];
      }
    }
    return workspace;
  }

  let rootPackageJsonContentsPromise = fetchJsonFile("package.json");

  let tree = await octokit.git.getTree({
    owner,
    repo,
    recursive: "1",
    tree_sha: ref
  });

  let itemsByDirPath = new Map<string, { path: string; sha: Sha }>();
  let potentialWorkspaceDirectories: string[] = [];
  for (let item of tree.data.tree) {
    if (item.path.endsWith("/package.json")) {
      let dirPath = nodePath.dirname(item.path);
      potentialWorkspaceDirectories.push(dirPath);
      itemsByDirPath.set(dirPath, item);
    }
  }
  let rootPackageJsonContent = await rootPackageJsonContentsPromise;
  let globs;
  if (rootPackageJsonContent.workspaces) {
    if (!Array.isArray(rootPackageJsonContent.workspaces)) {
      globs = rootPackageJsonContent.workspaces.packages;
    } else {
      globs = rootPackageJsonContent.workspaces;
    }
  } else if (
    rootPackageJsonContent.bolt &&
    rootPackageJsonContent.bolt.workspaces
  ) {
    globs = rootPackageJsonContent.bolt.workspaces;
  }
  let workspaces: Workspace[] = [];
  let rootWorkspace = {
    dir: "/",
    config: rootPackageJsonContent,
    name: rootPackageJsonContent.name
  };
  if (globs) {
    let matches = micromatch(potentialWorkspaceDirectories, globs).filter(
      match => changedFiles.some(changedFile => changedFile.includes(match))
    );

    workspaces = await Promise.all(
      matches.map(dir => getWorkspace(dir, itemsByDirPath.get(dir)!.sha))
    );
  } else {
    workspaces = [rootWorkspace];
  }

  let workspaceNames = new Set(workspaces.map(x => x.name));
  let resultCache: WorkspacesCache = {};
  for (let workspace of workspaces) {
    let cachedWorkspace: CachedWorkspace = {
      name: workspace.name,
      sha: itemsByDirPath.get(workspace.dir)!.sha,
      version: workspace.config.version
    };
    resultCache[workspace.name] = cachedWorkspace;
    for (let depType of depTypes) {
      if (workspace.config[depType]) {
        for (let dep in workspace.config[depType]) {
          if (workspaceNames.has(dep)) {
            if (cachedWorkspace[depType] === undefined) {
              cachedWorkspace[depType] = {};
            }
            cachedWorkspace[depType]![dep] = workspace.config[depType]![dep];
          }
        }
      }
    }
  }

  return { cache: resultCache, changedPackages: workspaces.map(x => x.name) };
};
