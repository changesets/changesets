"use strict";
exports.__esModule = true;
function maxType(types) {
    if (types.includes("major"))
        return "major";
    if (types.includes("minor"))
        return "minor";
    if (types.includes("patch"))
        return "patch";
    return "none";
}
function flattenReleases(changesets, allLinkedPackages) {
    var flatChangesets = changesets
        .map(function (changeset) { return changeset.releases.map(function (release) { return ({
        name: release.name,
        type: release.type,
        commit: changeset.commit,
        id: changeset.id
    }); }).concat(changeset.dependents.map(function (dependent) { return ({
        name: dependent.name,
        type: dependent.type,
        commit: changeset.commit,
        id: changeset.id
    }); })); })
        .reduce(function (acc, a) { return acc.concat(a); }, []) // flatten
        .reduce(function (acc, release) {
        if (!acc[release.name]) {
            acc[release.name] = [];
        }
        acc[release.name].push(release);
        return acc;
    }, {});
    var flatReleases = new Map(Object.entries(flatChangesets).map(function (_a) {
        var name = _a[0], releases = _a[1];
        return [
            name,
            {
                name: name,
                type: maxType(releases.map(function (r) { return r.type; })),
                commits: new Set(releases.map(function (r) { return r.commit; })).slice().filter(function (a) { return a; }),
                changesets: new Set(releases.map(function (r) { return r.id; })).slice()
            }
        ];
    }));
    for (var _i = 0, allLinkedPackages_1 = allLinkedPackages; _i < allLinkedPackages_1.length; _i++) {
        var linkedPackages = allLinkedPackages_1[_i];
        var allBumpTypes = [];
        for (var _a = 0, linkedPackages_1 = linkedPackages; _a < linkedPackages_1.length; _a++) {
            var linkedPackage = linkedPackages_1[_a];
            var release = flatReleases.get(linkedPackage);
            if (release) {
                allBumpTypes.push(release.type);
            }
        }
        var highestBumpType = maxType(allBumpTypes);
        for (var _b = 0, linkedPackages_2 = linkedPackages; _b < linkedPackages_2.length; _b++) {
            var linkedPackage = linkedPackages_2[_b];
            var release = flatReleases.get(linkedPackage);
            if (release) {
                release.type = highestBumpType;
            }
        }
    }
    return flatReleases.values().slice();
}
exports["default"] = flattenReleases;
