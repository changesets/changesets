import path from "path";
import fs from "fs-extra";

// This helper is designed to operate on the .changeset
// folder, and tidy up the subfolders
// THIS SHOULD BE REMOVED WHEN SUPPORT FOR CHANGESETS FROM V1 IS DROPPED

const removeEmptyFolders = async (folderPath: string) => {
  const dirContents = fs.readdirSync(folderPath);
  return Promise.all(
    dirContents.map(async contentPath => {
      const singleChangesetPath = path.resolve(folderPath, contentPath);
      try {
        if ((await fs.readdir(singleChangesetPath)).length < 1) {
          await fs.rmdir(singleChangesetPath);
        }
      } catch (err) {
        if (err.code !== "ENOTDIR") {
          throw err;
        }
      }
    })
  );
};

export { removeEmptyFolders };
