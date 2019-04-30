/* eslint-disable import/prefer-default-export */
import pkgDir from "pkg-dir";
import path from "path";

export const pkgPath = pkgDir.sync(__dirname);

// eslint-disable-next-line
export const defaultConfig = require(path.join(
  pkgPath,
  "default-files/config"
));
