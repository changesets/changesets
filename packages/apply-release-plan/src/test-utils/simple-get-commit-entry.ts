// We are doing it here to avoide adding a circular dependency and as this is only used in testing.
// This is wicked, and please don't copy us.

import path from "node:path";

const commitPath = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "cli",
  "dist",
  "changesets-cli-commit.js",
);
const commitModule = await import(commitPath);
export default commitModule.default;
