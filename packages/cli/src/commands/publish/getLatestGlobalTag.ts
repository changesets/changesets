import path from "path";
import fs from "fs-extra";

export default async function getLatestTag(
  cwd: string,
  globalFilename: string
): Promise<string | false> {
  let releaseNotesPath = path.join(cwd, globalFilename);
  let globalReleaseNotes;

  if (releaseNotesPath) {
    try {
      globalReleaseNotes = await fs.readFile(releaseNotesPath, "utf-8");
    } catch (e) {}
  }

  if (globalReleaseNotes) {
    let match = globalReleaseNotes.split("\n## ");
    let gotcha = match[1];
    if (!gotcha) return false;
    return gotcha.split("\n")[0];
  }

  return false;
}
