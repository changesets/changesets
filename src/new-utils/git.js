import spawn from "projector-spawn";
import path from "path";
import * as bolt from "bolt";

async function getMasterRef() {
  const gitCmd = await spawn("git", ["rev-parse", "master"]);
  return gitCmd.stdout.trim().split("\n")[0];
}

async function getCommitsSince(ref) {
  const gitCmd = await spawn("git", [
    "rev-list",
    "--no-merges",
    "--abbrev-commit",
    `${ref}..HEAD`
  ]);
  return gitCmd.stdout.trim().split("\n");
}

async function getChangedFilesSince(ref, fullPath = false) {
  // First we need to find the commit where we diverged from `ref` at using `git merge-base`
  let cmd = await spawn("git", ["merge-base", ref, "HEAD"]);
  const divergedAt = cmd.stdout.trim();
  // Now we can find which files we added
  cmd = await spawn("git", ["diff", "--name-only", divergedAt]);
  const files = cmd.stdout.trim().split("\n");
  if (!fullPath) return files;
  return files.map(file => path.resolve(file));
}

async function getChangedChangesetFilesSinceMaster(fullPath = false) {
  const ref = await getMasterRef();
  // First we need to find the commit where we diverged from `ref` at using `git merge-base`
  let cmd = await spawn("git", ["merge-base", ref, "HEAD"]);
  // Now we can find which files we added
  cmd = await spawn("git", [
    "diff",
    "--name-only",
    "--diff-filter=d",
    "master"
  ]);

  const files = cmd.stdout
    .trim()
    .split("\n")
    .filter(file => file.includes("changes.json"));
  if (!fullPath) return files;
  return files.map(file => path.resolve(file));
}

async function getBranchName() {
  const gitCmd = await spawn("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  return gitCmd.stdout.trim();
}

async function add(pathToFile) {
  const gitCmd = await spawn("git", ["add", pathToFile]);
  return gitCmd.code === 0;
}

async function commit(message) {
  const gitCmd = await spawn("git", ["commit", "-m", message, "--allow-empty"]);
  return gitCmd.code === 0;
}

// used to create a single tag at a time for the current head only
async function tag(tagStr) {
  // NOTE: it's important we use the -m flag otherwise 'git push --follow-tags' wont actually push
  // the tags
  const gitCmd = await spawn("git", ["tag", tagStr, "-m", tagStr]);
  return gitCmd.code === 0;
}

async function getCommitThatAddsFile(gitPath) {
  const gitCmd = await spawn("git", [
    "log",
    "--reverse",
    "--max-count=1",
    "--pretty=format:%h",
    "-p",
    gitPath
  ]);
  // For reasons I do not understand, passing pretty format through this is not working
  // The slice below is aimed at achieving the same thing.
  return gitCmd.stdout.split("\n")[0];
}

async function getChangedPackagesSinceCommit(commitHash) {
  const changedFiles = await getChangedFilesSince(commitHash, true);
  const project = await bolt.getProject();
  const projectDir = project.dir;
  const workspaces = await bolt.getWorkspaces();
  const allPackages = workspaces.map(pkg => ({
    ...pkg,
    relativeDir: path.relative(projectDir, pkg.dir)
  }));

  const fileNameToPackage = fileName =>
    allPackages.find(pkg => fileName.startsWith(pkg.dir + path.sep));

  const fileExistsInPackage = fileName => !!fileNameToPackage(fileName);

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
async function getChangedPackagesSinceMaster() {
  const masterRef = await getMasterRef();
  return getChangedPackagesSinceCommit(masterRef);
}

export {
  getCommitThatAddsFile,
  getCommitsSince,
  getChangedFilesSince,
  getBranchName,
  getMasterRef,
  add,
  commit,
  tag,
  getChangedPackagesSinceMaster,
  getChangedChangesetFilesSinceMaster
};
