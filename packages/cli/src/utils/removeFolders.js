"use strict";
exports.__esModule = true;
// @flow
var path_1 = require("path");
var fs_extra_1 = require("fs-extra");
// These two helpers are designed to operate on the .changeset
// folder, and tidy up the subfolders
var removeEmptyFolders = function (folderPath) {
    var dirContents = fs_extra_1["default"].readdirSync(folderPath);
    dirContents.forEach(function (contentPath) {
        var singleChangesetPath = path_1["default"].resolve(folderPath, contentPath);
        if (fs_extra_1["default"].statSync(singleChangesetPath).isDirectory() &&
            fs_extra_1["default"].readdirSync(singleChangesetPath).length < 1) {
            fs_extra_1["default"].rmdirSync(singleChangesetPath);
        }
    });
};
exports.removeEmptyFolders = removeEmptyFolders;
var removeFolders = function (folderPath) {
    if (!fs_extra_1["default"].existsSync(folderPath))
        return;
    var dirContents = fs_extra_1["default"].readdirSync(folderPath);
    dirContents.forEach(function (contentPath) {
        var singleChangesetPath = path_1["default"].resolve(folderPath, contentPath);
        if (fs_extra_1["default"].statSync(singleChangesetPath).isDirectory()) {
            fs_extra_1["default"].emptyDirSync(singleChangesetPath);
            fs_extra_1["default"].rmdirSync(singleChangesetPath);
        }
    });
};
exports.removeFolders = removeFolders;
