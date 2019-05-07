import pkgDir from "pkg-dir";
import path from "path";

export const pkgPath = pkgDir.sync(__dirname);

export const defaultConfig = require(path.join(
  pkgPath,
  "default-files/config"
));

export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "bundledDependencies",
  "optionalDependencies"
];
