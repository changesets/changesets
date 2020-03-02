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

// we're optimising for size of the cache here

type Deps = { [pkgName: string]: string };

enum WorkspaceContentKeys {
  dependencies = "1",
  devDependencies = "2",
  peerDependencies = "3",
  optionalDependencies = "4",
  version = "5",
  sha = "6",
  name = "7"
}

type Sha = string & { __sha: string };

type CachedRelease = [string, VersionType];

type CachedReleases = CachedRelease[];

type CachedChangeset = [Sha, CachedReleases, string];

type CachedWorkspace = {
  [WorkspaceContentKeys.name]: string;
  [WorkspaceContentKeys.sha]: Sha;
  [WorkspaceContentKeys.version]: string;
  [WorkspaceContentKeys.dependencies]?: Deps;
  [WorkspaceContentKeys.devDependencies]?: Deps;
  [WorkspaceContentKeys.peerDependencies]?: Deps;
  [WorkspaceContentKeys.optionalDependencies]?: Deps;
};

type WorkspacesCache = {
  [pkgPath: string]: CachedWorkspace;
};

type ChangesetCache = {
  [changesetPath: string]: CachedChangeset;
};

type CacheContent = [WorkspacesCache, ChangesetCache];

let defaultCache: CacheContent = [{}, {}];

let getReleasePlanFromGitHub = async ({
  owner,
  repo,
  ref,
  cache = defaultCache
}: {
  owner: string;
  repo: string;
  ref: string;
  cache?: CacheContent;
}) => {
  let [{ ...workspaceCache }, { ...changesetCache }] = cache;

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

  async function fetchChangeset(path: string): Promise<NewChangeset> {
    if (f) {
    }
    let output = await octokit.repos.getContents({
      owner,
      repo,
      path,
      ref
    });
    let changesetContent = Buffer.from(
      // @ts-ignore
      output.data.content,
      "base64"
    ).toString("utf8");
    let changeset = parseChangeset(changesetContent);
    // @ts-ignore
    changeset.id = nodePath.basename(path).replace(".md", "");
    // @ts-ignore
    return changeset;
  }

  // I'm assuming that a workspace will only be requested once per call to getReleasePlanFromGitHub
  // If that's an incorrect assumption, this should change
  async function getWorkspace(pkgPath: string, currentPkgSha: Sha) {
    let cachedWorkspace = workspaceCache[pkgPath];
    if (
      cachedWorkspace === undefined ||
      currentPkgSha !== cachedWorkspace[WorkspaceContentKeys.sha]
    ) {
      let jsonContent = await fetchJsonFile(pkgPath + "package.json");
      return {
        name: jsonContent.name,
        config: jsonContent,
        dir: pkgPath
      };
    }

    let name = cachedWorkspace[WorkspaceContentKeys.name];
    let workspace: Workspace = {
      name,
      dir: pkgPath,
      config: {
        name,
        version: cachedWorkspace[WorkspaceContentKeys.version]
      }
    };
    for (let depType of depTypes) {
      if (cachedWorkspace[WorkspaceContentKeys[depType]] !== undefined) {
        workspace.config[depType] =
          cachedWorkspace[WorkspaceContentKeys[depType]];
      }
    }
    return workspace;
  }

  let rootPackageJsonContentsPromise = fetchJsonFile("package.json");
  let configJsonPromise = fetchJsonFile(".changeset/config.json");

  let tree = await octokit.git.getTree({
    owner,
    repo,
    recursive: "1",
    tree_sha: ref
  });
  let preJsonContentPromise: Promise<undefined | PreState> = Promise.resolve(
    undefined
  );
  let itemsByDirPath = new Map<string, { path: string; sha: Sha }>();
  let potentialWorkspaceDirectories: string[] = [];
  let changesetPromises: (Promise<NewChangeset>)[] = [];
  for (let item of tree.data.tree) {
    if (item.path.endsWith("/package.json")) {
      let dirPath = nodePath.dirname(item.path);
      potentialWorkspaceDirectories.push(dirPath);
      itemsByDirPath.set(dirPath, item);
    } else if (
      item.path.startsWith(".changeset") &&
      item.path.endsWith(".md") &&
      item.path !== ".changeset/README.md"
    ) {
      changesetPromises.push(fetchChangeset(item.path));
    } else if (item.path === ".changeset/pre.json") {
      preJsonContentPromise = fetchJsonFile(".changeset/pre.json");
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
    let matches = micromatch(potentialWorkspaceDirectories, globs);
    workspaces = await Promise.all(
      matches.map(dir => getWorkspace(dir, itemsByDirPath.get(dir)!.sha))
    );
  } else {
    workspaces = [rootWorkspace];
  }

  let workspaceNames = new Set(workspaces.map(x => x.name));
  for (let workspace of workspaces) {
    let cachedWorkspace: CachedWorkspace = {
      [WorkspaceContentKeys.name]: workspace.name,
      [WorkspaceContentKeys.sha]: itemsByDirPath.get(workspace.dir)!.sha,
      [WorkspaceContentKeys.version]: workspace.config.version
    };
    for (let depType of depTypes) {
      if (workspace.config[depType]) {
        for (let dep in workspace.config[depType]) {
          if (workspaceNames.has(dep)) {
            if (cachedWorkspace[WorkspaceContentKeys[depType]] === undefined) {
              cachedWorkspace[WorkspaceContentKeys[depType]] = {};
            }
            cachedWorkspace[WorkspaceContentKeys[depType]]![
              dep
            ] = workspace.config[depType]![dep];
          }
        }
      }
    }
  }

  let releasePlan = assembleReleasePlan(
    await Promise.all(changesetPromises),
    workspaces,
    getDependentsGraphFromWorkspaces(workspaces, rootWorkspace),
    parseConfig(await configJsonPromise, workspaces),
    await preJsonContentPromise
  );

  return releasePlan;
};

(async () => {
  let releasePlan = await getReleasePlanFromGitHub({
    owner: "keystonejs",
    repo: "keystone",
    ref: "master"
  });
  console.log(releasePlan);
})();
