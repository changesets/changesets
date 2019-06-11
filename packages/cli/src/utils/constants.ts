import path from "path";

export const pkgPath = path.dirname(
  require.resolve("@changesets/cli/package.json")
);

export const defaultConfig = require(path.join(
  pkgPath,
  "default-files/config"
));

export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;
