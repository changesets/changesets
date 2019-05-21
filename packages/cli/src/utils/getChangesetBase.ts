import path from "path";
import { getProjectDirectory } from "./getProjectDirectory";

export default async function getChangesetBase(cwd: string) {
  const dir = await getProjectDirectory(cwd);
  return path.resolve(dir, ".changeset");
}
