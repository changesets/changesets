import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import picomatch from "picomatch";
import type { FullContext } from "./utils.ts";

function getUnmatchedPatterns(
  listOfPackageNamesOrGlob: readonly string[],
  pkgNames: readonly string[],
): string[] {
  return listOfPackageNamesOrGlob.filter((pkgOrGlob) => {
    const matcher = picomatch(pkgOrGlob);
    return !pkgNames.some((pkgName) => matcher(pkgName));
  });
}

const picomatchNote = `Note that glob expressions must be defined according to https://npmx.dev/picomatch.`;
const invalidPathOrGlobMessage = (pkgOrGlob: string) =>
  `Invalid path: The package or glob "${pkgOrGlob}" does not match any package in the project. ${picomatchNote}`;

type Rule = (ctx: FullContext) => void;

const fixedGroupsExist: Rule = ({
  config,
  writtenConfig,
  packageNames,
  warnings,
}) => {
  if (config.fixed.length === 0) return;

  for (const fixedGroup of writtenConfig.fixed ?? []) {
    warnings.push(
      ...getUnmatchedPatterns(fixedGroup, packageNames).map(
        invalidPathOrGlobMessage,
      ),
    );
  }
};

const noDuplicateFixedPackages: Rule = ({ config, errors }) => {
  if (config.fixed.length === 0) return;

  const foundNames = new Set<string>();
  const duplicatedNames = new Set<string>();

  for (const fixedGroup of config.fixed) {
    for (const name of fixedGroup) {
      if (foundNames.has(name)) {
        duplicatedNames.add(name);
      }
      foundNames.add(name);
    }
    errors.push(
      ...Array.from(duplicatedNames).map(
        (pkgOrGlob) =>
          `Invalid group: The package or glob "${pkgOrGlob}" is defined in multiple groups of fixed packages. Packages can only be belong to a single group. ${picomatchNote}`,
      ),
    );
  }
};

const linkedGroupsExist: Rule = ({
  config,
  writtenConfig,
  packageNames,
  warnings,
}) => {
  if (config.linked.length === 0) return;

  for (const linkedGroup of writtenConfig.linked ?? []) {
    warnings.push(
      ...getUnmatchedPatterns(linkedGroup, packageNames).map(
        invalidPathOrGlobMessage,
      ),
    );
  }
};

const noDuplicateLinkedPackages: Rule = ({ config, errors }) => {
  if (config.linked.length === 0) return;

  const foundNames = new Set<string>();
  const duplicatedNames = new Set<string>();

  for (const linkedGroup of config.linked) {
    for (const name of linkedGroup) {
      if (foundNames.has(name)) {
        duplicatedNames.add(name);
      }
      foundNames.add(name);
    }
    errors.push(
      ...Array.from(duplicatedNames).map(
        (pkgOrGlob) =>
          `Invalid group: The package or glob "${pkgOrGlob}" is defined in multiple groups of linked packages. Packages can only be belong to a single group. ${picomatchNote}`,
      ),
    );
  }
};

const noFixedAndLinkedPackages: Rule = ({ config, errors }) => {
  if (config.fixed.length === 0 || config.linked.length === 0) return;

  const allFixedPackages = new Set(config.fixed.flat());
  const allLinkedPackages = new Set(config.linked.flat());

  for (const fixedName of allFixedPackages) {
    if (allLinkedPackages.has(fixedName)) {
      errors.push(
        `Invalid group: The package "${fixedName}" can be found in both fixed and linked groups. A package can only be either fixed or linked.`,
      );
    }
  }
};

const ignoredPatternsExist: Rule = ({
  writtenConfig,
  packageNames,
  errors,
}) => {
  if (writtenConfig.ignore == null || writtenConfig.ignore.length === 0) return;

  errors.push(
    ...getUnmatchedPatterns(writtenConfig.ignore, packageNames).map(
      invalidPathOrGlobMessage,
    ),
  );
};

// Validate that dependents of skipped packages are also skipped.
// A package is "skipped" if it's in the ignore list, or if it's private
// and privatePackages.version is false.
// devDependencies are excluded because they don't affect published consumers —
// a stale devDep range on a skipped package is harmless.
// Note: assemble-release-plan uses a graph WITH devDeps because it needs to
// update devDep ranges in package.json even though they don't cause version bumps.
const alsoSkipDependentsOfSkipped: Rule = ({ packages, config, errors }) => {
  if (config.ignore.length === 0 && config.privatePackages.version) return;

  const dependentsGraph = getDependentsGraph(packages, {
    ignoreDevDependencies: true,
    bumpVersionsWithWorkspaceProtocolOnly:
      config.bumpVersionsWithWorkspaceProtocolOnly,
  });
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg] as const),
  );

  for (const pkg of packages.packages) {
    if (
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
    ) {
      continue;
    }
    const skippedPackage = pkg.packageJson.name;
    const dependents = dependentsGraph.get(skippedPackage) || [];
    for (const dependent of dependents) {
      const dependentPkg = packagesByName.get(dependent);
      if (!dependentPkg) {
        continue;
      }
      if (
        shouldSkipPackage(dependentPkg, {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.version,
        })
      ) {
        continue;
      }
      // Private packages don't publish to npm,
      // so they can safely depend on skipped packages.
      // This also holds for private packages with other publish targets (like a VS Code extension)
      // as those typically have to prebundle dependencies.
      if (dependentPkg.packageJson.private) {
        continue;
      }
      errors.push(
        `Invalid tree: "${dependent}" depends on the skipped package "${skippedPackage}", but "${dependent}" is not skipped. Please add "${dependent}" to the "ignore" option.`,
      );
    }
  }
};

const noPrivateTagWithoutPrivateVersion: Rule = ({ config, errors }) => {
  if (
    config.privatePackages.version === false &&
    config.privatePackages.tag === true
  ) {
    errors.push(
      `Invalid combination: The "tag" is set to "true" but "version" is set to "false". This is not allowed.`,
    );
  }
};

// TODO: add more details about this to docs, along with a link in the error message
// TODO: maybe add setting for GH Packages registry domain?
const internalButNotGitHubRegistry: Rule = ({ packages, config, warnings }) => {
  if (config.access !== "internal") return;

  const missingRegistry =
    packages.tool.type === "root"
      ? !packages.rootPackage!.packageJson.publishConfig?.access?.includes(
          "npm.pkg.github.com",
        )
      : packages.packages.some(
          (pkg) =>
            !pkg.packageJson.publishConfig?.registry?.includes(
              "npm.pkg.github.com",
            ),
        );

  if (missingRegistry) {
    warnings.push(
      `Potential issue: Setting "access" to "internal" is exclusive to GitHub Packages Registry but "publishConfig.registry" is not configured to use it.`,
    );
  }
};

// TODO: remove this alias
const noAccessPrivate: Rule = ({ writtenConfig, warnings }) => {
  if ((writtenConfig.access as unknown) !== "private") return;

  warnings.push('Deprecated: Use "restricted" instead of "private"');
};

const rules: Rule[] = [
  fixedGroupsExist,
  noDuplicateFixedPackages,
  linkedGroupsExist,
  noDuplicateLinkedPackages,
  noFixedAndLinkedPackages,
  ignoredPatternsExist,
  alsoSkipDependentsOfSkipped,
  noPrivateTagWithoutPrivateVersion,
  internalButNotGitHubRegistry,
  noAccessPrivate,
];

export function validateConfigByRules(
  ctx: Omit<FullContext, "warnings" | "errors">,
): Pick<FullContext, "warnings" | "errors"> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of rules) {
    rule({
      ...ctx,
      errors,
      warnings,
    });
  }

  return { errors, warnings };
}
