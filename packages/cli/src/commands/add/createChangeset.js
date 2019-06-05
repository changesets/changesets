// @flow

import { green, yellow, red } from "chalk";

import inquirer from "inquirer";
import semver from "semver";
import outdent from "outdent";
import fs from "fs-extra";
import path from "path";
import { getProjectDirectory } from "../../utils/getProjectDirectory";
import { createChangeset as createChangesetFromData } from "@changesets/create-changeset";

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
  function askInitialReleaseQuestion(defaultInquirerList) {
    return cli.askCheckboxPlus(
      // TODO: Make this wording better
      // TODO: take objects and be fancy with matching
      "Which packages would you like to include?",
      defaultInquirerList
    );
  }

  if (allPackages.length > 1) {
    const unchangedPackagesNames = allPackages
      .map(({ name }) => name)
      .filter(name => !changedPackages.includes(name));

    const selectAllPackagesOptions =
      allPackages.length > 10 ? ["All changed packages", "All packages"] : [];

    const defaultInquirerList = [
      ...selectAllPackagesOptions,
      new inquirer.Separator("changed packages"),
      ...changedPackages,
      new inquirer.Separator("unchanged packages"),
      ...unchangedPackagesNames,
      new inquirer.Separator()
    ];

    let packagesToRelease = await askInitialReleaseQuestion(
      defaultInquirerList
    );

    if (packagesToRelease.length === 0) {
      do {
        logger.error("You must select at least one package to release");
        logger.error("(You most likely hit enter instead of space!)");

        packagesToRelease = await askInitialReleaseQuestion(
          defaultInquirerList
        );
      } while (packagesToRelease.length === 0);
    } else if (packagesToRelease[0] === "All packages") {
      packagesToRelease = [...changedPackages, ...unchangedPackagesNames];
    } else if (packagesToRelease[0] === "All changed packages") {
      packagesToRelease = [...changedPackages];
    }
    return packagesToRelease;
  }
  return [allPackages[0].name];
}

async function getPackageBumpRange(pkgJSON) {
  const { name, version, maintainers } = pkgJSON;
  // Get the version range for a package someone has chosen to release
  let type = await cli.askList(
    `What kind of change is this for ${green(
      name
    )}? (current version is ${version})`,
    ["patch", "minor", "major"]
  );

  // for packages that are under v1, we want to make sure major releases are intended,
  // as some repo-wide sweeping changes have mistakenly release first majors
  // of packages.
  if (type === "major" && semver.lt(version, "1.0.0")) {
    let maintainersString = "";

    if (maintainers && Array.isArray(maintainers) && maintainers.length > 0) {
      maintainersString = ` (${maintainers.join(", ")})`;
    }
    // prettier-ignore
    const message = yellow(outdent`
      WARNING: Releasing a major version for ${green(name)} will be its ${red('first major release')}.
      If you are unsure if this is correct, contact the package's maintainers${maintainersString} ${red('before committing this changeset')}.

      If you still want to release this package, select the appropriate version below:
    `)
    // prettier-ignore-end
    type = await cli.askList(message, ["patch", "minor", "major"]);
  }

  return type;
}

export default async function createChangeset(
  changedPackages /* Array<string> */,
  opts /* { cwd?: string }  */ = {}
) {
  const cwd = opts.cwd || process.cwd();
  const allPackages = await bolt.getWorkspaces({ cwd });

  const packagesToRelease = await getPackagesToRelease(
    changedPackages,
    allPackages
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
    "Please enter a summary for this change (this will be in the changelogs)"
  );

  let summary = await cli.askQuestion("Summary");
  while (summary.length === 0) {
    logger.error("A summary is required for the changelog! 😪");
    summary = await cli.askQuestion("Summary");
  }
  let projectDir = await getProjectDirectory(cwd);
  let rootPkgJson = JSON.parse(
    await fs.readFile(path.join(projectDir, "package.json"))
  );
  let root = { config: rootPkgJson, name: rootPkgJson.name, dir: projectDir };
  return createChangesetFromData({
    summary,
    releases,
    packages: allPackages,
    root
  });
}
