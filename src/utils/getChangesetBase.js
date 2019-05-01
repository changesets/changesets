const pkgDir = require("pkg-dir");
const path = require("path");

async function getChangesetBase(cwd) {
  const dir = await pkgDir(cwd);
  return path.resolve(dir, ".changeset");
}

module.exports = getChangesetBase;
