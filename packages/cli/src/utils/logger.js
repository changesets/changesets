"use strict";
exports.__esModule = true;
var chalk_1 = require("chalk");
var util_1 = require("util");
exports.prefix = "🦋 ";
function format(args, customPrefix) {
    var fullPrefix = exports.prefix + (customPrefix === undefined ? "" : " " + customPrefix);
    return (fullPrefix +
        util_1["default"]
            .format.apply(util_1["default"], [""].concat(args)).split("\n")
            .join("\n" + fullPrefix + " "));
}
function log() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.log(format(args));
}
function info() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.error(format(args, chalk_1["default"].cyan("info")));
}
function warn() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.error(format(args, chalk_1["default"].yellow("warn")));
}
function error() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.error(format(args, chalk_1["default"].red("error")));
}
function success() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.log(format(args, chalk_1["default"].green("success")));
}
exports["default"] = {
    log: log,
    info: info,
    warn: warn,
    error: error,
    success: success
};
