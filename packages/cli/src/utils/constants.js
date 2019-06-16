"use strict";
exports.__esModule = true;
var path_1 = require("path");
exports.pkgPath = path_1["default"].dirname(require.resolve("@changesets/cli/package.json"));
exports.defaultConfig = require(path_1["default"].join(exports.pkgPath, "default-files/config"));
exports.DEPENDENCY_TYPES = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
];
