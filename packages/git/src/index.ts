import spawn from "spawndamnit";
import path from "path";
import getWorkspaces from "get-workspaces";
import pkgDir from "pkg-dir";

// TODO: Currently getting this working, need to decide how to
// share projectDir between packages if that's what we need
async function getProjectDirectory(cwd: string) {
  const projectDir = await pkgDir(cwd);
  if (!projectDir) {
    throw new Error("Could not find project directory");
  }
  return projectDir;
}

async function getMasterRef(cwd: string) {
  const gitCmd = await spawn("git", ["rev-parse", "master"], { cwd });
  return gitCmd.stdout
    .toString()
    .trim()
    .split("\n")[0];
}

async function add(pathToFile: string, cwd: string) {
  const gitCmd = await spawn("git", ["add", pathToFile], { cwd });
  return gitCmd.code === 0;
}

async function commit(message: string, cwd: string) {
  const gitCmd = await spawn(
    "git",
    ["commit", "-m", message, "--allow-empty"],
    { cwd }
  );
  return gitCmd.code === 0;
}

// used to create a single tag at a time for the current head only
async function tag(tagStr: string, cwd: string) {
  // NOTE: it's important we use the -m flag otherwise 'git push --follow-tags' wont actually push
  // the tags
  const gitCmd = await spawn("git", ["tag", tagStr, "-m", tagStr], { cwd });
  return gitCmd.code === 0;
}

async function getCommitThatAddsFile(gitPath: string, cwd: string) {
  const gitCmd = await spawn(
    "git",
    ["log", "--reverse", "--max-count=1", "--pretty=format:%h", "-p", gitPath],
    { cwd }
  );
  // For reasons I do not understand, passing pretty format through this is not working
  // The slice below is aimed at achieving the same thing.
  return gitCmd.stdout.toString().split("\n")[0];
}

async function getChangedFilesSince(
  ref: string,
  cwd: string,
  fullPath = false
): Promise<Array<string>> {
  // First we need to find the commit where we diverged from `ref` at using `git merge-base`
  let cmd = await spawn("git", ["merge-base", ref, "HEAD"], { cwd });
  const divergedAt = cmd.stdout.toString().trim();
  // Now we can find which files we added
  cmd = await spawn("git", ["diff", "--name-only", divergedAt], { cwd });
  const files = cmd.stdout
    .toString()
    .trim()
    .split("\n");
  if (!fullPath) return files;
  return files.map(file => path.resolve(cwd, file));
}

// below are less generic functions that we use in combination with other things we are doing
async function getChangedChangesetFilesSinceMaster(
  cwd: string,
  fullPath = false
): Promise<Array<string>> {
  const ref = await getMasterRef(cwd);
  // First we need to find the commit where we diverged from `ref` at using `git merge-base`
  let cmd = await spawn("git", ["merge-base", ref, "HEAD"], { cwd });
  // Now we can find which files we added
  cmd = await spawn(
    "git",
    ["diff", "--name-only", "--diff-filter=d", "master"],
    { cwd }
  );

  const files = cmd.stdout
    .toString()
    .trim()
    .split("\n")
    .filter(file => file.includes("changes.json"));
  if (!fullPath) return files;
  return files.map(file => path.resolve(cwd, file));
}

async function getChangedPackagesSinceCommit(commitHash: string, cwd: string) {
  const changedFiles = await getChangedFilesSince(commitHash, cwd, true);
  const projectDir = await getProjectDirectory(cwd);
  let workspaces = await getWorkspaces({
    cwd,
    tools: ["yarn", "bolt", "root"]
  });
  if (workspaces === null) {
    workspaces = [];
  }

  const allPackages = workspaces.map(pkg => ({
    ...pkg,
    relativeDir: path.relative(projectDir, pkg.dir)
  }));

  const fileNameToPackage = (fileName: string) =>
    allPackages.find(pkg => fileName.startsWith(pkg.dir + path.sep));

  const fileExistsInPackage = (fileName: string) =>
    !!fileNameToPackage(fileName);

  return (
    changedFiles
      // ignore deleted files
      .filter(fileExistsInPackage)
      .map(fileNameToPackage)
      // filter, so that we have only unique packages
      .filter((pkg, idx, packages) => packages.indexOf(pkg) === idx)
  );
}

// Note: This returns the packages that have changed AND been committed since master,
// it wont include staged/unstaged changes
//
// Don't use this function in master branch as it returns nothing in that case.
async function getChangedPackagesSinceMaster(cwd: string) {
  const masterRef = await getMasterRef(cwd);
  return getChangedPackagesSinceCommit(masterRef, cwd);
}

export {
  getCommitThatAddsFile,
  getChangedFilesSince,
  add,
  commit,
  tag,
  getChangedPackagesSinceMaster,
  getChangedChangesetFilesSinceMaster
};
