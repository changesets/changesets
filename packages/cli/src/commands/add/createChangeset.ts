import chalk from "chalk";

import semverLt from "semver/functions/lt";

import * as cli from "../../utils/cli-utilities";
import { error, log } from "@changesets/logger";
import { Release, PackageJSON } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import { ExitError } from "@changesets/errors";

const { green, yellow, red, bold, blue, cyan } = chalk;

async function confirmMajorRelease(pkgJSON: PackageJSON) {
  if (semverLt(pkgJSON.version, "1.0.0")) {
    // prettier-ignore
    log(yellow(`WARNING: Releasing a major version for ${green(pkgJSON.name)} will be its ${red('first major release')}.`))
    log(
      yellow(
        `If you are unsure if this is correct, contact the package's maintainers ${red(
          "before committing this changeset"
        )}.`
      )
    );

    let shouldReleaseFirstMajor = await cli.askConfirm(
      bold(
        `Are you sure you want to release the ${red(
          "first major version"
        )} of ${pkgJSON.name}?`
      )
    );
    return shouldReleaseFirstMajor;
  }
  return true;
}

export function createNamespacedChoiceMapper(namespace: string) {
  return (pkgName: string) => ({
    name: `${pkgName}#${namespace}`,
    message: pkgName,
    value: pkgName, // FIXME - this seems not to be working
  });
}

export function deNamespace(pkgName: string) {
  return pkgName.replace(/#.*$/, "");
}

enum ReleaseCategories {
  StagedPackages = "staged packages",
  ChangedPackages = "changed packages",
  UnchangedPakcages = "unchanged packages",
}

const isReleaseCategory = (x: string): x is ReleaseCategories =>
  [
    ReleaseCategories.StagedPackages,
    ReleaseCategories.ChangedPackages,
    ReleaseCategories.UnchangedPakcages,
  ].includes(x as ReleaseCategories);

async function getPackagesToRelease(
  stagedPackages: Array<string>,
  changedPackages: Array<string>,
  allPackages: Array<Package>
) {
  function askInitialReleaseQuestion(defaultChoiceList: Array<any>) {
    return cli.askCheckboxPlus(
      // TODO: Make this wording better
      // TODO: take objects and be fancy with matching
      `Which packages would you like to include?`,
      defaultChoiceList,
      (x) => {
        // this removes changed packages and unchanged packages from the list
        // of packages shown after selection
        if (Array.isArray(x)) {
          return x
            .filter((x) => !isReleaseCategory(x))
            .map((x) => cyan(x))
            .join(", ");
        }
        return x;
      }
    );
  }

  if (allPackages.length > 1) {
    const unchangedPackagesNames = allPackages
      .map(({ packageJson }) => packageJson.name)
      .filter(
        (name) =>
          !changedPackages.includes(name) && !stagedPackages.includes(name)
      );
    const defaultChoiceList = [
      {
        name: ReleaseCategories.StagedPackages,
        choices: stagedPackages.map(createNamespacedChoiceMapper("staged")),
      },
      {
        name: ReleaseCategories.ChangedPackages,
        choices: changedPackages.map(createNamespacedChoiceMapper("changed")),
      },
      {
        name: ReleaseCategories.UnchangedPakcages,
        choices: unchangedPackagesNames.map(
          createNamespacedChoiceMapper("unchanged")
        ),
      },
    ].filter(({ choices }) => choices.length !== 0);

    let packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);

    if (packagesToRelease.length === 0) {
      do {
        error("You must select at least one package to release");
        error("(You most likely hit enter instead of space!)");

        packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
      } while (packagesToRelease.length === 0);
    }
    return packagesToRelease
      .map(deNamespace)
      .filter((pkgName) => !isReleaseCategory(pkgName));
  }
  return [allPackages[0].packageJson.name];
}

function getPkgJsonsByName(packages: Package[]) {
  return new Map(
    packages.map(({ packageJson }) => [packageJson.name, packageJson])
  );
}

function formatPkgNameAndVersion(pkgName: string, version: string) {
  return `${bold(pkgName)}@${bold(version)}`;
}

export default async function createChangeset(
  stagedPackages: Array<string>,
  changedPackages: Array<string>,
  allPackages: Package[]
): Promise<{ confirmed: boolean; summary: string; releases: Array<Release> }> {
  const releases: Array<Release> = [];

  if (allPackages.length > 1) {
    const packagesToRelease = await getPackagesToRelease(
      stagedPackages,
      changedPackages,
      allPackages
    );

    let pkgJsonsByName = getPkgJsonsByName(allPackages);

    let pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);

    let pkgsThatShouldBeMajorBumped = (
      await cli.askCheckboxPlus(
        bold(`Which packages should have a ${red("major")} bump?`),
        [
          {
            name: "all packages",
            choices: packagesToRelease.map((pkgName) => {
              return {
                name: pkgName,
                message: formatPkgNameAndVersion(
                  pkgName,
                  pkgJsonsByName.get(pkgName)!.version
                ),
              };
            }),
          },
        ],
        (x) => {
          // this removes changed packages and unchanged packages from the list
          // of packages shown after selection
          if (Array.isArray(x)) {
            return x
              .filter((x) => x !== "all packages")
              .map((x) => cyan(x))
              .join(", ");
          }
          return x;
        }
      )
    ).filter((x) => x !== "all packages");

    for (const pkgName of pkgsThatShouldBeMajorBumped) {
      // for packages that are under v1, we want to make sure major releases are intended,
      // as some repo-wide sweeping changes have mistakenly release first majors
      // of packages.
      let pkgJson = pkgJsonsByName.get(pkgName)!;

      let shouldReleaseFirstMajor = await confirmMajorRelease(pkgJson);
      if (shouldReleaseFirstMajor) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);

        releases.push({ name: pkgName, type: "major" });
      }
    }

    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      let pkgsThatShouldBeMinorBumped = (
        await cli.askCheckboxPlus(
          bold(`Which packages should have a ${green("minor")} bump?`),
          [
            {
              name: "all packages",
              choices: [...pkgsLeftToGetBumpTypeFor].map((pkgName) => {
                return {
                  name: pkgName,
                  message: formatPkgNameAndVersion(
                    pkgName,
                    pkgJsonsByName.get(pkgName)!.version
                  ),
                };
              }),
            },
          ],
          (x) => {
            // this removes changed packages and unchanged packages from the list
            // of packages shown after selection
            if (Array.isArray(x)) {
              return x
                .filter((x) => x !== "all packages")
                .map((x) => cyan(x))
                .join(", ");
            }
            return x;
          }
        )
      ).filter((x) => x !== "all packages");

      for (const pkgName of pkgsThatShouldBeMinorBumped) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);

        releases.push({ name: pkgName, type: "minor" });
      }
    }

    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      log(`The following packages will be ${blue("patch")} bumped:`);
      pkgsLeftToGetBumpTypeFor.forEach((pkgName) => {
        log(
          formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName)!.version)
        );
      });

      for (const pkgName of pkgsLeftToGetBumpTypeFor) {
        releases.push({ name: pkgName, type: "patch" });
      }
    }
  } else {
    let pkg = allPackages[0];
    let type = await cli.askList(
      `What kind of change is this for ${green(
        pkg.packageJson.name
      )}? (current version is ${pkg.packageJson.version})`,
      ["patch", "minor", "major"]
    );
    if (type === "major") {
      let shouldReleaseAsMajor = await confirmMajorRelease(pkg.packageJson);
      if (!shouldReleaseAsMajor) {
        throw new ExitError(1);
      }
    }
    releases.push({ name: pkg.packageJson.name, type });
  }

  log(
    "Please enter a summary for this change (this will be in the changelogs)."
  );
  log(chalk.gray("  (submit empty line to open external editor)"));

  let summary = await cli.askQuestion("Summary");
  if (summary.length === 0) {
    try {
      summary = cli.askQuestionWithEditor(
        "\n\n# Please enter a summary for your changes.\n# An empty message aborts the editor."
      );
      if (summary.length > 0) {
        return {
          confirmed: true,
          summary,
          releases,
        };
      }
    } catch (err) {
      log(
        "An error happened using external editor. Please type your summary here:"
      );
    }

    summary = await cli.askQuestion("");
    while (summary.length === 0) {
      summary = await cli.askQuestion(
        "\n\n# A summary is required for the changelog! 😪"
      );
    }
  }

  return {
    confirmed: false,
    summary,
    releases,
  };
}
