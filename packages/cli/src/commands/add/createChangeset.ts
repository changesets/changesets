import c from "@changesets/color";
import { ExitError, InternalError } from "@changesets/errors";
import type { Package, PackageJSON, Release } from "@changesets/types";
import { log, type Option } from "@clack/prompts";
import semverLt from "semver/functions/lt.js";
import { askWithEditor } from "../../utils/askWithEditor.ts";
import * as cli from "../../utils/cli-utilities.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";

async function confirmMajorRelease({ name, version }: PackageJSON) {
  if (semverLt(version, "1.0.0")) {
    importantWarning(
      `
The ${c.red("major")} version of ${c.blue(name)} will be its ${c.red("first major release")} (1.0.0).
If you are unsure if this is correct, contact the package's maintainers ${c.red("before committing this changeset")}.
      `,
    );

    return cli.askConfirm(
      `Are you sure you want to release the ${c.red("first major version")} of ${name}?`,
    );
  }
  return true;
}

async function getPackagesToRelease(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
): Promise<string[]> {
  if (allPackages.length <= 1) {
    throw new InternalError(
      "getPackagesToRelease should not be called if there is only one package",
    );
  }

  const allSortedPackages = allPackages.toSorted((a, b) =>
    a.packageJson.name.localeCompare(b.packageJson.name),
  );
  const changedPackagesList: Option<string>[] = [];
  const unchangedPackagesList: Option<string>[] = [];

  for (const { packageJson } of allSortedPackages) {
    const pkgName = packageJson.name;
    const list = changedPackages.includes(pkgName)
      ? changedPackagesList
      : unchangedPackagesList;
    list.push({
      label: pkgName + (packageJson.private ? " (private)" : ""),
      value: pkgName,
    });
  }

  const multiselectValues: cli.MultiselectOptions<string> = {};
  if (changedPackagesList.length > 0) {
    multiselectValues["changed packages"] = changedPackagesList;
  }
  if (unchangedPackagesList.length > 0) {
    multiselectValues["unchanged packages"] = unchangedPackagesList;
  }

  return await cli.askMultiselect(
    // TODO: Make this wording better
    "Which packages were affected by the changes you made?",
    multiselectValues,
    { required: true },
  );
}

function getPkgJsonsByName(packages: Array<Package>) {
  return new Map(
    packages.map(({ packageJson }) => [packageJson.name, packageJson]),
  );
}

function formatPkgNameAndVersion(pkgName: string, version: string) {
  return `${c.bold(pkgName)}@${c.bold(version)}`;
}

type OptionsFromCli = {
  message?: string;
  major?: string[];
  minor?: string[];
  patch?: string[];
};

function getPackagesByOptions(option?: string[]) {
  return option ?? [];
}

function validateSelectedPackageNames(
  pkgNames: Set<string>,
  optionsFromCli: OptionsFromCli | undefined,
  messages: string[],
) {
  for (const [flag, packageNamesFromCli] of [
    ["--major", optionsFromCli?.major],
    ["--minor", optionsFromCli?.minor],
    ["--patch", optionsFromCli?.patch],
  ] as const) {
    for (const pkgName of packageNamesFromCli ?? []) {
      if (pkgNames.has(pkgName)) {
        continue;
      }

      messages.push(
        `The package ${c.blue(pkgName)} is passed to the \`${flag}\` option but it is not found in the project. You may have misspelled the package name.`,
      );
    }
  }
}

function validateDuplicatePackageNames(
  pkgNames: Set<string>,
  optionsFromCli: OptionsFromCli | undefined,
  messages: string[],
) {
  // Only raise duplicate errors for existing package names. Unknown packages are validated separately.
  const major = new Set(optionsFromCli?.major).intersection(pkgNames);
  const minor = new Set(optionsFromCli?.minor).intersection(pkgNames);
  const patch = new Set(optionsFromCli?.patch).intersection(pkgNames);

  const duplicates = major
    .intersection(minor)
    .union(major.intersection(patch))
    .union(minor.intersection(patch));

  for (const pkgName of duplicates) {
    const flags = [
      major.has(pkgName) && "--major",
      minor.has(pkgName) && "--minor",
      patch.has(pkgName) && "--patch",
    ].filter((flag) => flag !== false);

    messages.push(
      `The package ${c.blue(pkgName)} is passed to multiple release type options: ${flags.map((flag) => `\`${flag}\``).join(", ")}. Please select only one release type for this package.`,
    );
  }
}

export async function createChangeset(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
  optionsFromCli?: OptionsFromCli,
): Promise<{ confirmed: boolean; summary: string; releases: Array<Release> }> {
  const releases: Array<Release> = [];

  let confirmed = false;

  if (optionsFromCli?.major || optionsFromCli?.minor || optionsFromCli?.patch) {
    confirmed = true;
    const pkgNames = new Set(
      allPackages.map(({ packageJson }) => packageJson.name),
    );

    const messages: string[] = [];
    validateSelectedPackageNames(pkgNames, optionsFromCli, messages);
    validateDuplicatePackageNames(pkgNames, optionsFromCli, messages);

    if (messages.length > 0) {
      log.error(messages.join("\n"));
      throw new ExitError(1);
    }

    for (const [type, packageNamesFromCli] of [
      ["major", optionsFromCli?.major],
      ["minor", optionsFromCli?.minor],
      ["patch", optionsFromCli?.patch],
    ] as const) {
      for (const pkgName of packageNamesFromCli ?? []) {
        releases.push({ name: pkgName, type });
      }
    }
  } else if (allPackages.length > 1) {
    const packagesToRelease = await getPackagesToRelease(
      changedPackages,
      allPackages,
    );
    packagesToRelease.sort((a, b) => a.localeCompare(b));

    const pkgJsonsByName = getPkgJsonsByName(allPackages);

    const pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);

    const pkgsThatShouldBeMajorBumped = await cli.askMultiselect<string>(
      c.bold(
        `Which packages should have a ${c.red("major")} ${c.gray(`(${c.red("X")}.X.X)`)} bump?`,
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
      const pkgJson = pkgJsonsByName.get(pkgName)!;

      const shouldReleaseFirstMajor = await confirmMajorRelease(pkgJson);
      if (shouldReleaseFirstMajor) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);

        releases.push({ name: pkgName, type: "major" });
      }
    }

    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      const pkgsThatShouldBeMinorBumped = await cli.askMultiselect(
        c.bold(
          `Which packages should have a ${c.green("minor")} ${c.gray(`(X.${c.green("X")}.X)`)} bump?`,
        ),
        {
          "all packages": Array.from(pkgsLeftToGetBumpTypeFor, (pkgName) => ({
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
      const patchBumpedPackages = Array.from(
        pkgsLeftToGetBumpTypeFor,
        (pkgName) =>
          formatPkgNameAndVersion(
            pkgName,
            pkgJsonsByName.get(pkgName)!.version,
          ),
      );
      log.info(
        `
The following packages will be ${c.blue("patch")} ${c.gray(`(X.X.${c.blue("X")})`)} bumped:
${c.gray(patchBumpedPackages.join(", "))}
        `.trim(),
      );

      for (const pkgName of pkgsLeftToGetBumpTypeFor) {
        releases.push({ name: pkgName, type: "patch" });
      }
    }
  } else {
    const pkg = allPackages[0];
    const type = await cli.askList(
      `What kind of change is this for ${c.blue(pkg.packageJson.name)}? ${c.gray(`(current version is ${pkg.packageJson.version})`)}`,
      ["patch", "minor", "major"],
    );
    if (type === "major") {
      const shouldReleaseAsMajor = await confirmMajorRelease(pkg.packageJson);
      if (!shouldReleaseAsMajor) {
        throw new ExitError(1);
      }
    }
    releases.push({ name: pkg.packageJson.name, type });
  }

  if (optionsFromCli?.message != null) {
    return {
      confirmed,
      summary: optionsFromCli.message,
      releases,
    };
  }

  confirmed = false;

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
    } catch {
      summary = await cli.askQuestion(
        `${c.red(
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
    confirmed,
    summary,
    releases,
  };
}
