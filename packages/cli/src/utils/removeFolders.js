// @flow
import path from "path";
import fs from "fs-extra";

// These two helpers are designed to operate on the .changeset
// folder, and tidy up the subfolders

const removeEmptyFolders = folderPath => {
  const dirContents = fs.readdirSync(folderPath);
  dirContents.forEach(contentPath => {
    const singleChangesetPath = path.resolve(folderPath, contentPath);
    if (
      fs.statSync(singleChangesetPath).isDirectory() &&
      fs.readdirSync(singleChangesetPath).length < 1
    ) {
      fs.rmdirSync(singleChangesetPath);
    }
  });
};

const removeFolders = folderPath => {
  if (!fs.existsSync(folderPath)) return;
  const dirContents = fs.readdirSync(folderPath);
  dirContents.forEach(contentPath => {
    const singleChangesetPath = path.resolve(folderPath, contentPath);
    if (fs.statSync(singleChangesetPath).isDirectory()) {
      fs.emptyDirSync(singleChangesetPath);
      fs.rmdirSync(singleChangesetPath);
    }
  });
};

export { removeEmptyFolders, removeFolders };
