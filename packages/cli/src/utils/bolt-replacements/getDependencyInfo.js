"use strict";
exports.__esModule = true;
var constants_1 = require("../constants");
function getDependencyTypes(depName, config) {
    var matchedTypes = [];
    for (var _i = 0, DEPENDENCY_TYPES_1 = constants_1.DEPENDENCY_TYPES; _i < DEPENDENCY_TYPES_1.length; _i++) {
        var depType = DEPENDENCY_TYPES_1[_i];
        var deps = getDeps(depType, config);
        if (deps && deps[depName]) {
            matchedTypes.push(depType);
        }
    }
    return matchedTypes;
}
exports.getDependencyTypes = getDependencyTypes;
function getDependencyVersionRange(depName, config) {
    for (var _i = 0, DEPENDENCY_TYPES_2 = constants_1.DEPENDENCY_TYPES; _i < DEPENDENCY_TYPES_2.length; _i++) {
        var depType = DEPENDENCY_TYPES_2[_i];
        var deps = getDeps(depType, config);
        if (deps && deps[depName]) {
            return deps[depName];
        }
    }
    return null;
}
exports.getDependencyVersionRange = getDependencyVersionRange;
function getDeps(depType, config) {
    var deps = config[depType];
    if (typeof deps === "undefined")
        return;
    return deps;
}
