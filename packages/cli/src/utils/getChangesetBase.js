import pkgDir from "pkg-dir";
import path from "path";

export default async function getChangesetBase(cwd) {
  const dir = await pkgDir(cwd);
  return path.resolve(dir, ".changeset");
}
