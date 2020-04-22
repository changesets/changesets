import { defaultConfig } from '@changesets/config';
import { add, commit, getCommitThatAddsFile } from '@changesets/git';
import resolveFrom from 'resolve-from';
import fs from 'fs-extra';
import path from 'path';
import prettier from 'prettier';
import getVersionRangeType from '@changesets/get-version-range-type';
import { Range } from 'semver';
import outdent from 'outdent';
import startCase from 'lodash.startcase';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
const DEPENDENCY_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
function versionPackage(release, versionsToUpdate) {
  let {
    newVersion,
    packageJson
  } = release;
  packageJson.version = newVersion;

  for (let type of DEPENDENCY_TYPES) {
    let deps = packageJson[type];

    if (deps) {
      for (let {
        name,
        version
      } of versionsToUpdate) {
        let depCurrentVersion = deps[name];

        if (depCurrentVersion && // an empty string is the normalised version of x/X/*
        // we don't want to change these versions because they will match
        // any version and if someone makes the range that
        // they probably want it to stay like that
        new Range(depCurrentVersion).range !== "") {
          let rangeType = getVersionRangeType(depCurrentVersion);
          let newNewRange = `${rangeType}${version}`;
          deps[name] = newNewRange;
        }
      }
    }
  }

  return _objectSpread({}, release, {
    packageJson
  });
}

// This data is not depended upon by the publish step, but can be useful for other tools/debugging
// I believe it would be safe to deprecate this format
function createReleaseCommit(releasePlan, commit) {
  const numPackagesReleased = releasePlan.releases.length;
  const releasesLines = releasePlan.releases.map(release => `  ${release.name}@${release.newVersion}`).join("\n");
  return outdent`
    RELEASING: Releasing ${numPackagesReleased} package(s)

    Releases:
    ${releasesLines}
    ${commit ? "\n[skip ci]\n" : ""}
`;
}

async function generateChangesForVersionTypeMarkdown(obj, type) {
  let releaseLines = await Promise.all(obj[type]);
  releaseLines = releaseLines.filter(x => x);

  if (releaseLines.length) {
    return `### ${startCase(type)} Changes\n\n${releaseLines.join("\n")}\n`;
  }
} // release is the package and version we are releasing


async function generateMarkdown(release, releases, changesets, changelogFuncs, changelogOpts) {
  const releaseObj = {
    major: [],
    minor: [],
    patch: []
  }; // I sort of feel we can do better, as ComprehensiveReleases have an array
  // of the relevant changesets but since we need the version type for the
  // release in the changeset, I don't know if we can
  // We can filter here, but that just adds another iteration over this list

  changesets.forEach(cs => {
    const rls = cs.releases.find(r => r.name === release.name);

    if (rls) {
      releaseObj[rls.type].push(changelogFuncs.getReleaseLine(cs, rls.type, changelogOpts));
    }
  });
  let dependentReleases = releases.filter(rel => {
    return release.packageJson.dependencies && release.packageJson.dependencies[rel.name] || release.packageJson.devDependencies && release.packageJson.devDependencies[rel.name] || release.packageJson.peerDependencies && release.packageJson.peerDependencies[rel.name];
  });
  let relevantChangesetIds = new Set();
  dependentReleases.forEach(rel => {
    rel.changesets.forEach(cs => {
      relevantChangesetIds.add(cs);
    });
  });
  let relevantChangesets = changesets.filter(cs => relevantChangesetIds.has(cs.id));
  releaseObj.patch.push(changelogFuncs.getDependencyReleaseLine(relevantChangesets, dependentReleases, changelogOpts));
  return [`## ${release.newVersion}`, await generateChangesForVersionTypeMarkdown(releaseObj, "major"), await generateChangesForVersionTypeMarkdown(releaseObj, "minor"), await generateChangesForVersionTypeMarkdown(releaseObj, "patch")].filter(line => line).join("\n");
}

function ownKeys$1(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread$1(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys$1(Object(source), true).forEach(function (key) { _defineProperty$1(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys$1(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty$1(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

async function getCommitThatAddsChangeset(changesetId, cwd) {
  let commit = await getCommitThatAddsFile(`.changeset/${changesetId}.md`, cwd);

  if (commit) {
    return commit;
  }

  let commitForOldChangeset = await getCommitThatAddsFile(`.changeset/${changesetId}/changes.json`, cwd);

  if (commitForOldChangeset) {
    return commitForOldChangeset;
  }
}

async function applyReleasePlan(releasePlan, packages, config = defaultConfig) {
  let cwd = packages.root.dir;
  let touchedFiles = [];
  let {
    releases,
    changesets
  } = releasePlan;
  const versionCommit = createReleaseCommit(releasePlan, config.commit); // I think this might be the wrong place to do this, but gotta do it somewhere -  add changelog entries to releases

  let releaseWithChangelogs = await getReleasesWithChangelogs(releasePlan, packages.packages, config.changelog, cwd);

  if (releasePlan.preState !== undefined) {
    if (releasePlan.preState.mode === "exit") {
      await fs.remove(path.join(cwd, ".changeset", "pre.json"));
    } else {
      await fs.writeFile(path.join(cwd, ".changeset", "pre.json"), JSON.stringify(releasePlan.preState, null, 2) + "\n");
    }
  }

  let versionsToUpdate = releases.map(({
    name,
    newVersion
  }) => ({
    name,
    version: newVersion
  })); // iterate over releases updating packages

  let finalisedRelease = releaseWithChangelogs.map(release => {
    return versionPackage(release, versionsToUpdate);
  });
  let prettierConfig = await prettier.resolveConfig(cwd);

  for (let release of finalisedRelease) {
    let {
      changelog,
      packageJson,
      dir,
      name
    } = release;
    let pkgJSONPath = path.resolve(dir, "package.json");
    let changelogPath = path.resolve(dir, "CHANGELOG.md");
    let parsedConfig = prettier.format(JSON.stringify(packageJson), _objectSpread$1({}, prettierConfig, {
      parser: "json",
      printWidth: 20
    }));
    await fs.writeFile(pkgJSONPath, parsedConfig);
    touchedFiles.push(pkgJSONPath);

    if (changelog && changelog.length > 0) {
      await updateChangelog(changelogPath, changelog, name, prettierConfig);
      touchedFiles.push(changelogPath);
    }
  }

  if (releasePlan.preState === undefined || releasePlan.preState.mode === "exit") {
    let changesetFolder = path.resolve(cwd, ".changeset");
    await Promise.all(changesets.map(async changeset => {
      let changesetPath = path.resolve(changesetFolder, `${changeset.id}.md`);
      let changesetFolderPath = path.resolve(changesetFolder, changeset.id);

      if (await fs.pathExists(changesetPath)) {
        touchedFiles.push(changesetPath);
        await fs.remove(changesetPath); // TO REMOVE LOGIC - this works to remove v1 changesets. We should be removed in the future
      } else if (await fs.pathExists(changesetFolderPath)) {
        touchedFiles.push(changesetFolderPath);
        await fs.remove(changesetFolderPath);
      }
    }));
  }

  if (config.commit) {
    let newTouchedFilesArr = [...touchedFiles]; // Note, git gets angry if you try and have two git actions running at once
    // So we need to be careful that these iterations are properly sequential

    while (newTouchedFilesArr.length > 0) {
      let file = newTouchedFilesArr.shift();
      await add(path.relative(cwd, file), cwd);
    }

    let commit$1 = await commit(versionCommit, cwd);

    if (!commit$1) {
      console.error("Changesets ran into trouble committing your files");
    }
  } // We return the touched files mostly for testing purposes


  return touchedFiles;
}
/**
 * Retrieves the releases from `releasePlan` with their generated markdown changelog entries
 */

async function getReleasesWithChangelogs(releasePlan, packages, changelogConfig, cwd) {
  const packagesByName = new Map(packages.map(x => [x.packageJson.name, x]));
  let releasesWithPackage = releasePlan.releases.map(release => {
    let pkg = packagesByName.get(release.name);
    if (!pkg) throw new Error(`Could not find matching package for release of: ${release.name}`);
    return _objectSpread$1({}, release, {}, pkg);
  });
  let getChangelogFuncs = {
    getReleaseLine: () => Promise.resolve(""),
    getDependencyReleaseLine: () => Promise.resolve("")
  };
  let changelogOpts;

  if (changelogConfig) {
    changelogOpts = changelogConfig[1];
    let changesetPath = path.join(cwd, ".changeset");
    let changelogPath = resolveFrom(changesetPath, changelogConfig[0]);

    let possibleChangelogFunc = require(changelogPath);

    if (possibleChangelogFunc.default) {
      possibleChangelogFunc = possibleChangelogFunc.default;
    }

    if (typeof possibleChangelogFunc.getReleaseLine === "function" && typeof possibleChangelogFunc.getDependencyReleaseLine === "function") {
      getChangelogFuncs = possibleChangelogFunc;
    } else {
      throw new Error("Could not resolve changelog generation functions");
    }
  }

  let moddedChangesets = await Promise.all(releasePlan.changesets.map(async cs => _objectSpread$1({}, cs, {
    commit: await getCommitThatAddsChangeset(cs.id, cwd)
  })));
  return Promise.all(releasesWithPackage.map(async release => {
    let changelog = await generateMarkdown(release, releasesWithPackage, moddedChangesets, getChangelogFuncs, changelogOpts);
    return _objectSpread$1({}, release, {
      changelog
    });
  })).catch(e => {
    console.error("The following error was encountered while generating changelog entries");
    console.error("We have escaped applying the changesets, and no files should have been affected");
    throw e;
  });
}

async function updateChangelog(changelogPath, changelog, name, prettierConfig) {
  let templateString = `\n\n${changelog.trim()}\n`;

  try {
    if (fs.existsSync(changelogPath)) {
      await prependFile(changelogPath, templateString, name, prettierConfig);
    } else {
      await fs.writeFile(changelogPath, `# ${name}${templateString}`);
    }
  } catch (e) {
    console.warn(e);
  }
}

async function prependFile(filePath, data, name, prettierConfig) {
  const fileData = fs.readFileSync(filePath).toString(); // if the file exists but doesn't have the header, we'll add it in

  if (!fileData) {
    const completelyNewChangelog = `# ${name}${data}`;
    await fs.writeFile(filePath, prettier.format(completelyNewChangelog, _objectSpread$1({}, prettierConfig, {
      parser: "markdown"
    })));
    return;
  }

  const newChangelog = fileData.replace("\n", data);
  await fs.writeFile(filePath, prettier.format(newChangelog, _objectSpread$1({}, prettierConfig, {
    parser: "markdown"
  })));
}

export default applyReleasePlan;
export { getReleasesWithChangelogs };
