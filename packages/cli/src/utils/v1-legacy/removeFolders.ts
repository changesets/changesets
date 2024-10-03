import { readdirSync } from "fs";
import { readdir, rmdir } from "fs/promises";
import path from "path";

// This helper is designed to operate on the .changeset
// folder, and tidy up the subfolders
// THIS SHOULD BE REMOVED WHEN SUPPORT FOR CHANGESETS FROM V1 IS DROPPED

const removeEmptyFolders = async (folderPath: string) => {
  const dirContents = readdirSync(folderPath);
  return Promise.all(
    dirContents.map(async (contentPath) => {
      const singleChangesetPath = path.resolve(folderPath, contentPath);
      try {
        if ((await readdir(singleChangesetPath)).length < 1) {
          await rmdir(singleChangesetPath);
        }
      } catch (err) {
        if ((err as any).code !== "ENOTDIR") {
          throw err;
        }
      }
    })
  );
};

export { removeEmptyFolders };
