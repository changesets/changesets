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
exports.__esModule = true;
var semver_1 = require("semver");
var flattenChangesets_1 = require("./flattenChangesets");
/*
  This flattens an array of Version objects into one object that can be used to create the changelogs
  and the publish commit messages.

  Dependents will be calculated and added to releases, then final versions will be calculated.

  It's output will look like

  {
    releases: [{
      name: 'package-a',
      version: '2.0.0',                // actual version being released
      commits: ['fc4229d'],            // filtered to ones for this pkg
                                       // (used in changelogs)
      dependencies: ['package-c']      // list of dependencies that will need to be updated
    },
    {
      name: 'package-b'
      version: '1.1.0',
      commits: ['fc4229d'],           // these would be the commits that caused bumps
      dependencies: ['package-a']
    },
    {
      name: 'package-c'
      version: '1.0.1',
      commits: ['fc4229d'],
      dependencies: ['package-b']
    }]

    changesets: [<Changeset>] // References to all the changesets used to build Release
                              // to be able to look up summary and release notes
                              // information when building changelogs
  }
*/
function createRelease(changesets, allPackages, allLinkedPackages) {
    // First, combine all the changeset.releases into one useful array
    if (allLinkedPackages === void 0) { allLinkedPackages = []; }
    var flattenedChangesets = flattenChangesets_1["default"](changesets, allLinkedPackages);
    var currentVersions = new Map();
    for (var _i = 0, allPackages_1 = allPackages; _i < allPackages_1.length; _i++) {
        var pkg = allPackages_1[_i];
        currentVersions.set(pkg.name, 
        // @ts-ignore
        pkg.config.version !== undefined ? pkg.config.version : null);
    }
    for (var _a = 0, allLinkedPackages_1 = allLinkedPackages; _a < allLinkedPackages_1.length; _a++) {
        var linkedPackages = allLinkedPackages_1[_a];
        var highestVersion = void 0;
        for (var _b = 0, linkedPackages_1 = linkedPackages; _b < linkedPackages_1.length; _b++) {
            var linkedPackage = linkedPackages_1[_b];
            var version = currentVersions.get(linkedPackage);
            if (highestVersion === undefined || semver_1["default"].gt(version, highestVersion)) {
                highestVersion = version;
            }
        }
        for (var _c = 0, linkedPackages_2 = linkedPackages; _c < linkedPackages_2.length; _c++) {
            var linkedPackage = linkedPackages_2[_c];
            currentVersions.set(linkedPackage, highestVersion);
        }
    }
    var allReleases = [];
    for (var _d = 0, flattenedChangesets_1 = flattenedChangesets; _d < flattenedChangesets_1.length; _d++) {
        var flattenedChangeset = flattenedChangesets_1[_d];
        if (flattenedChangeset.type === "none") {
            continue;
        }
        allReleases.push(__assign({}, flattenedChangeset, { version: semver_1["default"].inc(currentVersions.get(flattenedChangeset.name), flattenedChangeset.type) }));
    }
    return {
        releases: allReleases.filter(function (release) { return release.version !== null; }),
        deleted: allReleases.filter(function (release) { return release.version === null; }),
        changesets: changesets
    };
}
exports["default"] = createRelease;
