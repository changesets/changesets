"use strict";
exports.__esModule = true;
function versionRangeToRangeType(versionRange) {
    if (versionRange.charAt(0) === "^")
        return "^";
    if (versionRange.charAt(0) === "~")
        return "~";
    return "";
}
exports["default"] = versionRangeToRangeType;
