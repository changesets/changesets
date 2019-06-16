"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs_extra_1 = require("fs-extra");
var path_1 = require("path");
var git = require("@changesets/git");
// TODO take in cwd, and fetch changesetBase ourselves
function getChangesets(changesetBase, sinceMasterOnly) {
    return __awaiter(this, void 0, void 0, function () {
        var dirs, changesets, newChangesets, newHahses_1, changesetContents;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!fs_extra_1["default"].existsSync(changesetBase)) {
                        throw new Error("There is no .changeset directory in this project");
                    }
                    dirs = fs_extra_1["default"].readdirSync(changesetBase);
                    changesets = dirs.filter(function (dir) {
                        return fs_extra_1["default"].lstatSync(path_1["default"].join(changesetBase, dir)).isDirectory();
                    });
                    if (!sinceMasterOnly) return [3 /*break*/, 2];
                    return [4 /*yield*/, git.getChangedChangesetFilesSinceMaster(changesetBase)];
                case 1:
                    newChangesets = _a.sent();
                    newHahses_1 = newChangesets.map(function (c) { return c.split("/")[1]; });
                    changesets = changesets.filter(function (dir) { return newHahses_1.includes(dir); });
                    _a.label = 2;
                case 2:
                    changesetContents = changesets.map(function (changesetDir) { return __awaiter(_this, void 0, void 0, function () {
                        var summary, jsonPath, json, commit;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    summary = fs_extra_1["default"].readFileSync(path_1["default"].join(changesetBase, changesetDir, "changes.md"), "utf-8");
                                    jsonPath = path_1["default"].join(changesetBase, changesetDir, "changes.json");
                                    json = require(jsonPath);
                                    return [4 /*yield*/, git.getCommitThatAddsFile(jsonPath, changesetBase)];
                                case 1:
                                    commit = _a.sent();
                                    return [2 /*return*/, __assign({}, json, { summary: summary, commit: commit, id: changesetDir })];
                            }
                        });
                    }); });
                    return [2 /*return*/, Promise.all(changesetContents)];
            }
        });
    });
}
exports["default"] = getChangesets;
