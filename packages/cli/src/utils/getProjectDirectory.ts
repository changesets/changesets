import pkgDir from "pkg-dir";

export async function getProjectDirectory(cwd: string) {
  const projectDir = await pkgDir(cwd);
  if (!projectDir) {
    throw new Error("Could not find project directory");
  }
  return projectDir;
}
