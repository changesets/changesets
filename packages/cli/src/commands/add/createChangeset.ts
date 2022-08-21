import { promisify } from "util";

import chalk from "chalk";

import semver from "semver";

import * as cli from "../../utils/cli-utilities";
import { error, info, log } from "@changesets/logger";
import { Release, PackageJSON } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import { ExitError } from "@changesets/errors";
import lernaLog from "npmlog";
// @ts-expect-error
import { getChangelogConfig } from "@lerna/conventional-commits/lib/get-changelog-config";
import conventionalRecommendedBump from "conventional-recommended-bump";

const conventionalRecommendedBumpAsync = promisify<
  conventionalRecommendedBump.Options,
  conventionalRecommendedBump.Callback.Recommendation
>(conventionalRecommendedBump);

const { green, yellow, red, bold, blue, cyan } = chalk;

export interface CreateChangesetOptions {
  all?: boolean;
  allChanged?: boolean;
  allUnchanged?: boolean;
  conventionalCommits?: string | false;
  message?: string;
  recommend?: boolean;
  yes?: boolean;
}

// Silence Lerna
lernaLog.level = "silent";

async function confirmMajorRelease(pkgJSON: PackageJSON) {
  if (semver.lt(pkgJSON.version, "1.0.0")) {
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

async function getPackagesToRelease(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
  options: CreateChangesetOptions
) {
  function askInitialReleaseQuestion(defaultChoiceList: Array<any>) {
    return cli.askCheckboxPlus(
      // TODO: Make this wording better
      // TODO: take objects and be fancy with matching
      `Which packages would you like to include?`,
      defaultChoiceList,
      undefined,
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
      .map(({ packageJson }) => packageJson.name)
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

    let packagesToRelease;

    if (options.all === true) {
      info(`Selecting all packages for release`);
      packagesToRelease = allPackages.map(
        ({ packageJson }) => packageJson.name
      );
    } else if (options.allChanged === true) {
      info(`Selecting all changed packages for release`);
      packagesToRelease = changedPackages;
    } else if (options.allUnchanged === true) {
      info(`Selecting all unchanged packages for release`);
      packagesToRelease = unchangedPackagesNames;
    } else {
      packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
    }

    if (packagesToRelease.length === 0) {
      do {
        error("You must select at least one package to release");
        error("(You most likely hit enter instead of space!)");

        packagesToRelease = await askInitialReleaseQuestion(defaultChoiceList);
      } while (packagesToRelease.length === 0);
    }
    return packagesToRelease.filter(
      pkgName =>
        pkgName !== "changed packages" && pkgName !== "unchanged packages"
    );
  }
  return [allPackages[0].packageJson.name];
}

function formatPkgNameAndVersion(pkgName: string, version: string) {
  return `${bold(pkgName)}@${bold(version)}`;
}

function getPkgJsonByName(packages: Package[]) {
  return new Map(
    packages.map(({ packageJson }) => [packageJson.name, packageJson])
  );
}
function getPkgDirByName(packages: Package[]) {
  return new Map(
    packages.map(({ dir, packageJson }) => [packageJson.name, dir])
  );
}

export default async function createChangeset(
  changedPackages: Array<string>,
  allPackages: Package[],
  options: CreateChangesetOptions
): Promise<{ confirmed: boolean; summary: string; releases: Array<Release> }> {
  const releases: Array<Release> = [];

  if (allPackages.length > 1) {
    const packagesToRelease = await getPackagesToRelease(
      changedPackages,
      allPackages,
      options
    );

    let pkgJsonsByName = getPkgJsonByName(allPackages);
    let pkgDirsByName = getPkgDirByName(allPackages);

    let pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);

    const bumpSets = {
      major: new Set<string>(),
      minor: new Set<string>(),
      patch: new Set<string>()
    };
    if (typeof options.conventionalCommits === "string") {
      for (const pkgName of pkgsLeftToGetBumpTypeFor) {
        const conventionalOptions: conventionalRecommendedBump.Options = {
          config: await getChangelogConfig(options.conventionalCommits),
          lernaPackage: pkgName,
          path: pkgDirsByName.get(pkgName)
        };
        const data = await conventionalRecommendedBumpAsync(
          conventionalOptions
        );
        if (options.recommend === true) {
          releases.push({ name: pkgName, type: data.releaseType ?? "patch" });
        } else {
          bumpSets[data.releaseType ?? "patch"].add(pkgName);
        }
      }
      if (options.recommend === true) {
        log(`Recommending version bumps using conventional commits`);
        pkgsLeftToGetBumpTypeFor.clear();
      } else {
        info(
          `Selecting version bumps using conventional commits`
        );
        log(`(Hit enter for defaults)`);
      }
    }
    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      let pkgsThatShouldBeMajorBumped = (
        await cli.askCheckboxPlus(
          bold(`Which packages should have a ${red("major")} bump?`),
          [
            {
              name: "all packages",
              choices: packagesToRelease.map(pkgName => {
                return {
                  name: pkgName,
                  message: formatPkgNameAndVersion(
                    pkgName,
                    pkgJsonsByName.get(pkgName)!.version
                  )
                };
              })
            }
          ],
          [...pkgsLeftToGetBumpTypeFor]
            .map(pkgName => (bumpSets.major.has(pkgName) ? pkgName : undefined))
            .filter(value => value !== undefined) as string[],
          x => {
            // this removes changed packages and unchanged packages from the list
            // of packages shown after selection
            if (Array.isArray(x)) {
              return x
                .filter(x => x !== "all packages")
                .map(x => cyan(x))
                .join(", ");
            }
            return x;
          }
        )
      ).filter(x => x !== "all packages");

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
                choices: [...pkgsLeftToGetBumpTypeFor].map(pkgName => {
                  return {
                    name: pkgName,
                    message: formatPkgNameAndVersion(
                      pkgName,
                      pkgJsonsByName.get(pkgName)!.version
                    )
                  };
                })
              }
            ],
            [...pkgsLeftToGetBumpTypeFor]
              .map(pkgName =>
                bumpSets.minor.has(pkgName) ? pkgName : undefined
              )
              .filter(value => value !== undefined) as string[],
            x => {
              // this removes changed packages and unchanged packages from the list
              // of packages shown after selection
              if (Array.isArray(x)) {
                return x
                  .filter(x => x !== "all packages")
                  .map(x => cyan(x))
                  .join(", ");
              }
              return x;
            }
          )
        ).filter(x => x !== "all packages");

        for (const pkgName of pkgsThatShouldBeMinorBumped) {
          pkgsLeftToGetBumpTypeFor.delete(pkgName);

          releases.push({ name: pkgName, type: "minor" });
        }
      }

      if (pkgsLeftToGetBumpTypeFor.size !== 0) {
        log(`The following packages will be ${blue("patch")} bumped:`);
        pkgsLeftToGetBumpTypeFor.forEach(pkgName => {
          log(
            formatPkgNameAndVersion(
              pkgName,
              pkgJsonsByName.get(pkgName)!.version
            )
          );
        });

        for (const pkgName of pkgsLeftToGetBumpTypeFor) {
          releases.push({ name: pkgName, type: "patch" });
        }
      }
    }
  } else {
    let pkg = allPackages[0];

    let type;
    if (typeof options.conventionalCommits === "string") {
      const conventionalOptions: conventionalRecommendedBump.Options = {
        config: await getChangelogConfig(options.conventionalCommits),
        lernaPackage: pkg.packageJson.name,
        path: pkg.dir
      };
      const data = await conventionalRecommendedBumpAsync(conventionalOptions);
      type = data.releaseType ?? "patch";
    } else {
      type = await cli.askList(
        `What kind of change is this for ${green(
          pkg.packageJson.name
        )}? (current version is ${pkg.packageJson.version})`,
        ["patch", "minor", "major"]
      );
    }
    if (type === "major" && options.yes !== true) {
      let shouldReleaseAsMajor = await confirmMajorRelease(pkg.packageJson);
      if (!shouldReleaseAsMajor) {
        throw new ExitError(1);
      }
    }
    releases.push({ name: pkg.packageJson.name, type });
  }
  if (options.message === undefined) {
    log(
      "Please enter a summary for this change (this will be in the changelogs)."
    );
    log(chalk.gray("  (submit empty line to open external editor)"));
  }

  let summary = options.message ?? (await cli.askQuestion("Summary"));
  if (summary.length === 0) {
    try {
      summary = cli.askQuestionWithEditor(
        "\n\n# Please enter a summary for your changes.\n# An empty message aborts the editor."
      );
      if (summary.length > 0) {
        return {
          confirmed: true,
          summary,
          releases
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
    releases
  };
}
