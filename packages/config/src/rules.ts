import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import picomatch from "picomatch";
import type { ValidationContext } from "./utils.ts";

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

type Rule = (ctx: ValidationContext) => void;

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
        (pkgOrGlob) => `fixed: ${invalidPathOrGlobMessage(pkgOrGlob)}`,
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
          `fixed: Invalid group: The package or glob "${pkgOrGlob}" is defined in multiple groups of fixed packages. Packages can only be belong to a single group. ${picomatchNote}`,
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
        (pkgOrGlob) => `linked: ${invalidPathOrGlobMessage(pkgOrGlob)}`,
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
          `linked: Invalid group: The package or glob "${pkgOrGlob}" is defined in multiple groups of linked packages. Packages can only be belong to a single group. ${picomatchNote}`,
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
      (pkgOrGlob) => `ignore: ${invalidPathOrGlobMessage(pkgOrGlob)}`,
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
  const { version, tag } = config.privatePackages;

  if (version === false && tag === true) {
    errors.push(
      `privatePackages: Invalid combination: "tag" is set to "true" but "version" is set to "false".`,
    );
  }
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
];

export function validateConfigByRules(
  ctx: Omit<ValidationContext, "warnings" | "errors">,
): Pick<ValidationContext, "warnings" | "errors"> {
  const fullCtx: ValidationContext = { ...ctx, errors: [], warnings: [] };

  for (const rule of rules) {
    rule(fullCtx);
  }

  return { errors: fullCtx.errors, warnings: fullCtx.warnings };
}
