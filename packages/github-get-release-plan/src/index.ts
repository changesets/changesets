// @ts-ignore
import dotenv from "dotenv";

dotenv.config();

import Octokit from "@octokit/rest";
import nodePath from "path";
import micromatch from "micromatch";
import { Workspace, NewChangeset, PreState } from "@changesets/types";
import parseChangeset from "@changesets/parse";
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { parse as parseConfig } from "@changesets/config";
import { getDependentsGraphFromWorkspaces } from "get-dependents-graph";

let octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

let getReleasePlanFromGitHub = async ({
  owner,
  repo,
  ref
}: {
  owner: string;
  repo: string;
  ref: string;
}) => {
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
  let itemsByDirPath = new Map();
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
      matches.map(async dir => {
        let config = await fetchJsonFile(dir + "/package.json");
        return { dir, config, name: config.name };
      })
    );
  } else {
    workspaces = [rootWorkspace];
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
