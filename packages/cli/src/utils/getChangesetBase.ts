import path from "path";
import pkgDir from "pkg-dir";

async function getProjectDirectory(cwd: string) {
  const projectDir = await pkgDir(cwd);
  if (!projectDir) {
    throw new Error("Could not find project directory");
  }
  return projectDir;
}

export default async function getChangesetBase(cwd: string) {
  const dir = await getProjectDirectory(cwd);
  return path.resolve(dir, ".changeset");
}
