/* eslint-disable no-console */
// @flow

const { green, yellow, red } = require('chalk');
const bolt = require('bolt');

const cli = require('@atlaskit/build-utils/cli');
const logger = require('@atlaskit/build-utils/logger');
const inquirer = require('inquirer');
const semver = require('semver');
const outdent = require('outdent');

/*::
type releaseType = {
  name: string,
  type: string,
}
type dependentType = {
  name: string,
  type?: string,
  dependencies: Array<string>,
}
type changesetDependentType = {
  name: string,
  dependencies: Array<string>,
  type?: string,
}
type changesetType = {
  summary: string,
  releases: Array<releaseType>,
  dependents: Array<changesetDependentType>,
  releaseNotes?: any,
}
*/

async function getPackageBumpRange(pkgJSON) {
  const { name, version, maintainers } = pkgJSON;
  // Get the version range for a package someone has chosen to release
  let type = await cli.askList(
    `What kind of change is this for ${green(
      name,
    )}? (current version is ${version})`,
    ['patch', 'minor', 'major'],
  );

  // for packages that are under v1, we want to make sure major releases are intended,
  // as some repo-wide sweeping changes have mistakenly release first majors
  // of packages.
  if (type === 'major' && semver.lt(version, '1.0.0')) {
    let maintainersString = '';

    if (maintainers && Array.isArray(maintainers) && maintainers.length > 0) {
      maintainersString = ` (${maintainers.join(', ')})`;
    }
    // prettier-ignore
    const message = yellow(outdent`
      WARNING: Releasing a major version for ${green(name)} will be its ${red('first major release')}.
      If you are unsure if this is correct, contact the package's maintainers${maintainersString} ${red('before committing this changeset')}.

      If you still want to release this package, select the appropriate version below:
    `)
    // prettier-ignore-end
    type = await cli.askList(message, ['patch', 'minor', 'major']);
  }

  return type;
}

async function createChangeset(
  changedPackages /*: Array<string> */,
  opts /*: { cwd?: string }  */ = {},
) {
  const cwd = opts.cwd || process.cwd();
  const allPackages = await bolt.getWorkspaces({ cwd });
  const dependencyGraph = await bolt.getDependentsGraph({ cwd });

  // helper because we do this a lot
  const getPackageJSON = pkgName =>
    allPackages.find(({ name }) => name === pkgName).config;

  const packagesToRelease = await getPackagesToRelease(
    changedPackages,
    allPackages,
  );

  const releases = [];

  // We use a for loop instead of a map because we need to ensure they are
  // run in sequence
  for (const pkg of packagesToRelease) {
    const pkgJSON = allPackages.find(({ name }) => name === pkg).config;

    const type = await getPackageBumpRange(pkgJSON);

    releases.push({ name: pkg, type });
  }

  logger.log(
    'Please enter a summary for this change (this will be in the changelogs)',
  );

  let summary = await cli.askQuestion('Summary');
  while (summary.length === 0) {
    logger.error('A summary is required for the changelog! 😪');
    summary = await cli.askQuestion('Summary');
  }

  let pkgsToSearch = [...releases];
  const dependents = [];

  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependencyGraph.get(nextRelease.name);

    // For each dependent we are going to see whether it needs to be bumped because it's dependency
    // is leaving the version range.
    pkgDependents
      .map(dependent => {
        let type = 'none';

        const dependentPkgJSON = getPackageJSON(dependent);
        const { depTypes, versionRange } = getDependencyVersionRange(
          dependentPkgJSON,
          nextRelease.name,
        );
        // Firstly we check if it is a peerDependency because if it is, our dependent bump type needs to be major.
        if (
          depTypes.includes('peerDependencies') &&
          nextRelease.type !== 'patch'
        ) {
          type = 'major';
        } else {
          const nextReleaseVersion = semver.inc(
            getPackageJSON(nextRelease.name).version,
            nextRelease.type,
          );
          if (
            !dependents.some(dep => dep.name === dependent) &&
            !releases.some(dep => dep.name === dependent) &&
            !semver.satisfies(nextReleaseVersion, versionRange)
          ) {
            type = 'patch';
          }
        }
        return { name: dependent, type };
      })
      .filter(({ type }) => type !== 'none')
      .forEach(dependent => {
        const existing = dependents.find(dep => dep.name === dependent.name);
        // For things that are being given a major bump, we check if we have already
        // added them here. If we have, we update the existing item instead of pushing it on to search.
        // It is safe to not add it to pkgsToSearch because it should have already been searched at the
        // largest possible bump type.
        if (
          existing &&
          dependent.type === 'major' &&
          existing.type !== 'major'
        ) {
          existing.type = 'major';
        } else {
          pkgsToSearch.push(dependent);
          dependents.push(dependent);
        }
      });
  }

  // Now we need to fill in the dependencies arrays for each of the dependents. We couldn't accurately
  // do it until now because we didn't have the entire list of packages being released yet
  dependents.forEach(dependent => {
    const dependentPkgJSON = getPackageJSON(dependent.name);
    dependent.dependencies = [...dependents, ...releases]
      .map(pkg => pkg.name)
      .filter(
        dep => !!getDependencyVersionRange(dependentPkgJSON, dep).versionRange,
      );
  });

  return {
    summary,
    releases,
    dependents,
  };
}

async function getPackagesToRelease(changedPackages, allPackages) {
  function askInitialReleaseQuestion(defaultInquirerList) {
    return cli.askCheckboxPlus(
      // TODO: Make this wording better
      // TODO: take objects and be fancy with matching
      'Which packages would you like to include?',
      defaultInquirerList,
    );
  }

  const unchangedPackagesNames = allPackages
    .map(({ name }) => name)
    .filter(name => !changedPackages.includes(name));

  const defaultInquirerList = [
    new inquirer.Separator('changed packages'),
    ...changedPackages,
    new inquirer.Separator('unchanged packages'),
    ...unchangedPackagesNames,
    new inquirer.Separator(),
  ];

  let packagesToRelease = await askInitialReleaseQuestion(defaultInquirerList);

  if (packagesToRelease.length === 0) {
    do {
      logger.error('You must select at least one package to release');
      logger.error('(You most likely hit enter instead of space!)');

      packagesToRelease = await askInitialReleaseQuestion(defaultInquirerList);
    } while (packagesToRelease.length === 0);
  }
  return packagesToRelease;
}

/*
  Returns an object in the shape { depTypes: [], versionRange: '' } with a list of different depTypes
  matched ('dependencies', 'peerDependencies', etc) and the versionRange itself ('^1.0.0')
*/

function getDependencyVersionRange(dependentPkgJSON, dependencyName) {
  const DEPENDENCY_TYPES = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'bundledDependencies',
    'optionalDependencies',
  ];
  const dependencyVersionRange = {
    depTypes: [],
    versionRange: '',
  };
  for (const type of DEPENDENCY_TYPES) {
    const deps = dependentPkgJSON[type];
    if (!deps) continue;
    if (deps[dependencyName]) {
      dependencyVersionRange.depTypes.push(type);
      // We'll just override this each time, *hypothetically* it *should* be the same...
      dependencyVersionRange.versionRange = deps[dependencyName];
    }
  }
  return dependencyVersionRange;
}

module.exports = createChangeset;
