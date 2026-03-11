import pc from "picocolors";
import { log } from "@clack/prompts";
import type { Package, PackageJSON, Release } from "@changesets/types";
import { ExitError } from "@changesets/errors";
import semverLt from "semver/functions/lt.js";

import { askWithEditor } from "../../utils/askWithEditor.ts";
import * as cli from "../../utils/cli-utilities.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";

async function confirmMajorRelease({ name, version }: PackageJSON) {
  if (semverLt(version, "1.0.0")) {
    importantWarning(
      `
The ${pc.red("major")} version of ${pc.blue(name)} will be its ${pc.red("first major release")} (1.0.0).
If you are unsure if this is correct, contact the package's maintainers ${pc.red("before committing this changeset")}.   
      `,
    );

    return cli.askConfirm(
      `Are you sure you want to release the ${pc.red("first major version")} of ${name}?`,
    );
  }
  return true;
}

async function getPackagesToRelease(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
): Promise<string[]> {
  if (allPackages.length > 1) {
    const unchangedPackagesNames = allPackages
      .map(({ packageJson }) => packageJson.name)
      .filter((name) => !changedPackages.includes(name));

    const defaultChoiceList = Object.fromEntries(
      (
        [
          [
            "changed packages",
            changedPackages
              .toSorted((a, b) => a.localeCompare(b))
              .map((value) => ({ value })),
          ],
          [
            "unchanged packages",
            unchangedPackagesNames
              .toSorted((a, b) => a.localeCompare(b))
              .map((value) => ({ value })),
          ],
        ] as const
      ).filter(([_, choices]) => choices.length !== 0),
    );

    const packagesToRelease = await cli.askMultiselect(
      // TODO: Make this wording better
      "Which packages were affected by the changes you made?",
      defaultChoiceList,
    );

    return packagesToRelease.filter(
      (pkgName) =>
        pkgName !== "changed packages" && pkgName !== "unchanged packages",
    );
  }
  return [allPackages[0].packageJson.name];
}

function getPkgJsonsByName(packages: Array<Package>) {
  return new Map(
    packages.map(({ packageJson }) => [packageJson.name, packageJson]),
  );
}

function formatPkgNameAndVersion(pkgName: string, version: string) {
  return `${pc.bold(pkgName)}@${pc.bold(version)}`;
}

export default async function createChangeset(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
  messageFromCli?: string,
): Promise<{ confirmed: boolean; summary: string; releases: Array<Release> }> {
  const releases: Array<Release> = [];

  if (allPackages.length > 1) {
    const packagesToRelease = await getPackagesToRelease(
      changedPackages,
      allPackages,
    );
    packagesToRelease.sort((a, b) => a.localeCompare(b));

    let pkgJsonsByName = getPkgJsonsByName(allPackages);

    let pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);

    let pkgsThatShouldBeMajorBumped = await cli.askMultiselect<string>(
      pc.bold(
        `Which packages should have a ${pc.red("major")} ${pc.gray(`(${pc.red("X")}.X.X)`)} bump?`,
      ),
      {
        "all packages": packagesToRelease.map((pkgName) => ({
          label: formatPkgNameAndVersion(
            pkgName,
            pkgJsonsByName.get(pkgName)!.version,
          ),
          value: pkgName,
        })),
      },
    );

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
      let pkgsThatShouldBeMinorBumped = await cli.askMultiselect(
        pc.bold(
          `Which packages should have a ${pc.green("minor")} ${pc.gray(`(X.${pc.green("X")}.X)`)} bump?`,
        ),
        {
          "all packages": [...pkgsLeftToGetBumpTypeFor].map((pkgName) => ({
            label: formatPkgNameAndVersion(
              pkgName,
              pkgJsonsByName.get(pkgName)!.version,
            ),
            value: pkgName,
          })),
        },
      );

      for (const pkgName of pkgsThatShouldBeMinorBumped) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);

        releases.push({ name: pkgName, type: "minor" });
      }
    }

    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      const patchBumpedPackages = [...pkgsLeftToGetBumpTypeFor].map((pkgName) =>
        formatPkgNameAndVersion(pkgName, pkgJsonsByName.get(pkgName)!.version),
      );
      log.info(
        `
The following packages will be ${pc.blue("patch")} ${pc.gray(`(X.X.${pc.blue("X")})`)} bumped:
${pc.gray(patchBumpedPackages.join(", "))}
        `.trim(),
      );

      for (const pkgName of pkgsLeftToGetBumpTypeFor) {
        releases.push({ name: pkgName, type: "patch" });
      }
    }
  } else {
    let pkg = allPackages[0];
    let type = await cli.askList(
      `What kind of change is this for ${pc.blue(pkg.packageJson.name)}? ${pc.gray(`(current version is ${pkg.packageJson.version})`)}`,
      ["patch", "minor", "major"],
    );
    if (type === "major") {
      let shouldReleaseAsMajor = await confirmMajorRelease(pkg.packageJson);
      if (!shouldReleaseAsMajor) {
        throw new ExitError(1);
      }
    }
    releases.push({ name: pkg.packageJson.name, type });
  }

  if (messageFromCli != null) {
    return {
      confirmed: false,
      summary: messageFromCli,
      releases,
    };
  }

  let summary = await cli.askQuestion(
    "Please enter a summary for this change (this will be in the changelogs).",
    { placeholder: "  (submit nothing to open an external editor)" },
  );

  if (summary.length === 0) {
    try {
      summary = await askWithEditor(
        "\n\n# Please enter a summary for your changes.\n# An empty message aborts the editor.",
      );
      if (summary.length > 0) {
        return {
          confirmed: true,
          summary,
          releases,
        };
      }
    } catch (err) {
      summary = await cli.askQuestion(
        `${pc.red(
          "An error happened using external editor. Please type your summary here:",
        )}`,
        { notEmpty: true },
      );
    }

    summary ||= await cli.askQuestion(
      "Did not find a summary in the edited file. Please enter one:",
      { notEmpty: true },
    );
  }

  return {
    confirmed: false,
    summary,
    releases,
  };
}
