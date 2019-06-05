// @flow

import { green, yellow, red, bold, blue, cyan } from "chalk";

import semver from "semver";

import * as cli from "../../utils/cli";
import logger from "../../utils/logger";
import * as bolt from "../../utils/bolt-replacements";

/*
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

async function getPackagesToRelease(changedPackages, allPackages) {
  function askInitialReleaseQuestion(defaultChoiceList) {
    return cli.askCheckboxPlus(
      // TODO: Make this wording better
      // TODO: take objects and be fancy with matching
      `Which packages would you like to include?`,
      defaultChoiceList,
      x => {
        // this removes changed packages and unchanged packages from the list
        // of packages shown after selection
        if (Array.isArray(x)) {
          return x
            .filter(x => x !== "changed packages" && x !== "unchanged packages")
            .map(x => cyan(x))
            .join(", ");
        }
        return x;
      }
    );
  }

  if (allPackages.length > 1) {
    const unchangedPackagesNames = allPackages
      .map(({ name }) => name)
      .filter(name => !changedPackages.includes(name));

    const defaultChoiceList = [
      {
        name: "changed packages",
        choices: changedPackages
      },
      {
        name: "unchanged packages",
        choices: unchangedPackagesNames
      }
    ].filter(({ choices }) => choices.length !== 0);

    let packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);

    if (packagesToRelease.length === 0) {
      do {
        logger.error("You must select at least one package to release");
        logger.error("(You most likely hit enter instead of space!)");

        packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
      } while (packagesToRelease.length === 0);
    }
    return packagesToRelease.filter(
      pkgName =>
        pkgName !== "changed packages" && pkgName !== "unchanged packages"
    );
  }
  return [allPackages[0].name];
}

function formatPkgNameAndVersion(pkgName, version) {
  return `${bold(pkgName)}@${bold(version)}`;
}

/*
  Returns an object in the shape { depTypes: [], versionRange: '' } with a list of different depTypes
  matched ('dependencies', 'peerDependencies', etc) and the versionRange itself ('^1.0.0')
*/

function getDependencyVersionRange(dependentPkgJSON, dependencyName) {
  const DEPENDENCY_TYPES = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "bundledDependencies",
    "optionalDependencies"
  ];
  const dependencyVersionRange = {
    depTypes: [],
    versionRange: ""
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

export default async function createChangeset(
  changedPackages /* Array<string> */,
  opts /* { cwd?: string }  */ = {}
) {
  const cwd = opts.cwd || process.cwd();
  const allPackages = await bolt.getWorkspaces({ cwd });

  const dependencyGraph = await bolt.getDependentsGraph({ cwd });

  const packagesToRelease = await getPackagesToRelease(
    changedPackages,
    allPackages
  );

  let pkgJsonsByName = new Map(
    allPackages.map(({ name, config }) => [name, config])
  );

  const releases = [];

  let pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);

  let pkgsThatShouldBeMajorBumped = await cli.askCheckboxPlus(
    bold(`Which packages should have a ${red("major")} bump?`),
    packagesToRelease.map(pkgName => {
      return {
        name: pkgName,
        message: formatPkgNameAndVersion(
          pkgName,
          pkgJsonsByName.get(pkgName).version
        )
      };
    })
  );

  for (const pkgName of pkgsThatShouldBeMajorBumped) {
    // for packages that are under v1, we want to make sure major releases are intended,
    // as some repo-wide sweeping changes have mistakenly release first majors
    // of packages.
    let { version, maintainers } = pkgJsonsByName.get(pkgName);
    if (semver.lt(version, "1.0.0")) {
      let maintainersString = "";

      if (maintainers && Array.isArray(maintainers) && maintainers.length > 0) {
        maintainersString = ` (${maintainers.join(", ")})`;
      }
      // prettier-ignore
      logger.log(yellow(`WARNING: Releasing a major version for ${green(pkgName)} will be its ${red('first major release')}.`))
      logger.log(
        yellow(
          `If you are unsure if this is correct, contact the package's maintainers${maintainersString} ${red(
            "before committing this changeset"
          )}.`
        )
      );

      let shouldReleaseFirstMajor = await cli.askConfirm(
        bold(
          `Are you sure you want still want to release the ${red(
            "first major release"
          )} of ${pkgName}?`
        )
      );
      if (!shouldReleaseFirstMajor) {
        continue;
      }
    }
    pkgsLeftToGetBumpTypeFor.delete(pkgName);

    releases.push({ name: pkgName, type: "major" });
  }

  if (pkgsLeftToGetBumpTypeFor.size !== 0) {
    let pkgsThatShouldBeMinorBumped = await cli.askCheckboxPlus(
      bold(`Which packages should have a ${green("minor")} bump?`),
      [...pkgsLeftToGetBumpTypeFor].map(pkgName => {
        return {
          name: pkgName,
          message: formatPkgNameAndVersion(
            pkgName,
            pkgJsonsByName.get(pkgName).version
          )
        };
      })
    );

    for (const pkgName of pkgsThatShouldBeMinorBumped) {
      pkgsLeftToGetBumpTypeFor.delete(pkgName);

      releases.push({ name: pkgName, type: "minor" });
    }
  }

  if (pkgsLeftToGetBumpTypeFor.size !== 0) {
    logger.log(`The following packages will be ${blue("patch")} bumped:`);
    pkgsLeftToGetBumpTypeFor.forEach(pkgName => {
      logger.log(
        formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName).version)
      );
    });

    for (const pkgName of pkgsLeftToGetBumpTypeFor) {
      releases.push({ name: pkgName, type: "patch" });
    }
  }

  logger.log(
    "Please enter a summary for this change (this will be in the changelogs)"
  );

  let summary = await cli.askQuestion("Summary");
  while (summary.length === 0) {
    logger.error("A summary is required for the changelog! 😪");
    summary = await cli.askQuestion("Summary");
  }

  const pkgsToSearch = [...releases];
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
        let type = "none";

        const dependentPkgJSON = pkgJsonsByName.get(dependent);
        const { depTypes, versionRange } = getDependencyVersionRange(
          dependentPkgJSON,
          nextRelease.name
        );
        // Firstly we check if it is a peerDependency because if it is, our dependent bump type needs to be major.
        if (
          depTypes.includes("peerDependencies") &&
          nextRelease.type !== "patch"
        ) {
          type = "major";
        } else {
          const nextReleaseVersion = semver.inc(
            pkgJsonsByName.get(nextRelease.name).version,
            nextRelease.type
          );
          if (
            !dependents.some(dep => dep.name === dependent) &&
            !releases.some(dep => dep.name === dependent) &&
            !semver.satisfies(nextReleaseVersion, versionRange)
          ) {
            type = "patch";
          }
        }
        return { name: dependent, type };
      })
      .filter(({ type }) => type !== "none")
      .forEach(dependent => {
        const existing = dependents.find(dep => dep.name === dependent.name);
        // For things that are being given a major bump, we check if we have already
        // added them here. If we have, we update the existing item instead of pushing it on to search.
        // It is safe to not add it to pkgsToSearch because it should have already been searched at the
        // largest possible bump type.
        if (
          existing &&
          dependent.type === "major" &&
          existing.type !== "major"
        ) {
          existing.type = "major";
        } else {
          pkgsToSearch.push(dependent);
          dependents.push(dependent);
        }
      });
  }

  // Now we need to fill in the dependencies arrays for each of the dependents. We couldn't accurately
  // do it until now because we didn't have the entire list of packages being released yet
  dependents.forEach(dependent => {
    const dependentPkgJSON = pkgJsonsByName.get(dependent.name);
    dependent.dependencies = [...dependents, ...releases]
      .map(pkg => pkg.name)
      .filter(
        dep => !!getDependencyVersionRange(dependentPkgJSON, dep).versionRange
      );
  });

  return {
    summary,
    releases,
    dependents
  };
}
