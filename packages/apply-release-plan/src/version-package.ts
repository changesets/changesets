import { parseCatalogProtocol } from "@changesets/catalogs";
import type {
  CatalogEntryUpdate,
  ComprehensiveRelease,
  DependencyType,
  PackageJSON,
  Packages,
} from "@changesets/types";
import Range from "semver/classes/range.js";
import semverPrerelease from "semver/functions/prerelease.js";
import validRange from "semver/ranges/valid.js";
import type { EditJsonOperation } from "./edit-json.ts";
import { shouldUpdateDependencyBasedOnConfig } from "./utils.ts";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type VersionToUpdate = ComprehensiveRelease & { dir: string };

export type DependencyUpdateOptions = {
  cwd: string;
  updateInternalDependencies: "patch" | "minor";
  onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  snapshot?: string | boolean | undefined;
};

export function getDependencyVersionEdits(
  packageJson: PackageJSON,
  versionsToUpdate: VersionToUpdate[],
  {
    cwd,
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  }: DependencyUpdateOptions,
): EditJsonOperation[] {
  const pkgJsonEdits: EditJsonOperation[] = [];

  for (const depType of DEPENDENCY_TYPES) {
    const deps = packageJson[depType];
    if (deps) {
      for (const release of versionsToUpdate) {
        if (release.newVersion == null) {
          continue;
        }

        const { name, newVersion } = release;
        let depCurrentVersion = deps[name];
        if (
          !depCurrentVersion ||
          depCurrentVersion.startsWith("file:") ||
          depCurrentVersion.startsWith("link:") ||
          // catalog ranges live in the catalog, they get updated there instead
          parseCatalogProtocol(depCurrentVersion) != null ||
          !shouldUpdateDependencyBasedOnConfig(
            cwd,
            release,
            {
              depVersionRange: depCurrentVersion,
              depType,
            },
            {
              minReleaseType: updateInternalDependencies,
              onlyUpdatePeerDependentsWhenOutOfRange,
            },
          )
        ) {
          continue;
        }
        const usesWorkspaceRange = depCurrentVersion.startsWith("workspace:");

        if (
          !usesWorkspaceRange &&
          (bumpVersionsWithWorkspaceProtocolOnly ||
            validRange(depCurrentVersion) == null)
        ) {
          continue;
        }

        if (usesWorkspaceRange) {
          const workspaceDepVersion = depCurrentVersion.replace(
            /^workspace:/,
            "",
          );
          if (
            workspaceDepVersion === "*" ||
            workspaceDepVersion === "^" ||
            workspaceDepVersion === "~" ||
            validRange(workspaceDepVersion) == null
          ) {
            continue;
          }
          depCurrentVersion = workspaceDepVersion;
        }
        if (
          // an empty string is the normalised version of x/X/*
          // we don't want to change these versions because they will match
          // any version and if someone makes the range that
          // they probably want it to stay like that...
          new Range(depCurrentVersion).range !== "" ||
          // ...unless the current version of a dependency is a prerelease (which doesn't satisfy x/X/*)
          // leaving those as is would leave the package in a non-installable state (wrong dep versions would get installed)
          semverPrerelease(newVersion) != null
        ) {
          let newNewRange = snapshot
            ? newVersion
            : `${getVersionRangeType(depCurrentVersion)}${newVersion}`;
          if (usesWorkspaceRange) newNewRange = `workspace:${newNewRange}`;
          pkgJsonEdits.push({ keys: [depType, name], value: newNewRange });
        }
      }
    }
  }

  return pkgJsonEdits;
}

function getVersionRangeType(
  versionRange: string,
): "^" | "~" | ">=" | "<=" | ">" | "" {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  if (versionRange.startsWith(">=")) return ">=";
  if (versionRange.startsWith("<=")) return "<=";
  if (versionRange.charAt(0) === ">") return ">";
  return "";
}

export function getCatalogEntryUpdates(
  packages: Packages,
  versionsToUpdate: VersionToUpdate[],
  {
    cwd,
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  }: DependencyUpdateOptions,
): CatalogEntryUpdate[] {
  const catalogs = packages.catalogs;
  // `catalog:` is not the workspace protocol, so it's out of scope for this option
  if (!catalogs?.entries.size || bumpVersionsWithWorkspaceProtocolOnly) {
    return [];
  }

  const references = getCatalogReferences(packages);
  const updates: CatalogEntryUpdate[] = [];

  for (const release of versionsToUpdate) {
    if (release.newVersion == null) {
      continue;
    }

    for (const [catalogName, catalog] of catalogs.entries) {
      const currentRange = catalog.get(release.name);

      if (currentRange == null || validRange(currentRange) == null) {
        continue;
      }

      // Entries no package in the workspace references are left alone
      const depTypes = references.get(catalogName)?.get(release.name);

      if (!depTypes?.size) {
        continue;
      }

      const shouldUpdate = [...depTypes].some((depType) =>
        shouldUpdateDependencyBasedOnConfig(
          cwd,
          release,
          { depVersionRange: currentRange, depType },
          {
            minReleaseType: updateInternalDependencies,
            onlyUpdatePeerDependentsWhenOutOfRange,
          },
        ),
      );

      if (!shouldUpdate) {
        continue;
      }

      // See the equivalent check in `getDependencyVersionEdits` for the reasoning
      if (
        new Range(currentRange).range === "" &&
        semverPrerelease(release.newVersion) == null
      ) {
        continue;
      }

      updates.push({
        catalogName,
        dependencyName: release.name,
        value: snapshot
          ? release.newVersion
          : `${getVersionRangeType(currentRange)}${release.newVersion}`,
      });
    }
  }

  return updates;
}

/** catalog name -> dependency name -> the dependency types it's referenced through */
function getCatalogReferences(packages: Packages) {
  const references = new Map<string, Map<string, Set<DependencyType>>>();

  const allPackages = packages.rootPackage
    ? [...packages.packages, packages.rootPackage]
    : packages.packages;

  for (const pkg of allPackages) {
    for (const depType of DEPENDENCY_TYPES) {
      for (const [depName, range] of Object.entries(
        pkg.packageJson[depType] ?? {},
      )) {
        const catalogName = parseCatalogProtocol(range);

        if (catalogName == null) {
          continue;
        }

        let catalog = references.get(catalogName);

        if (!catalog) {
          catalog = new Map();
          references.set(catalogName, catalog);
        }

        let depTypes = catalog.get(depName);

        if (!depTypes) {
          depTypes = new Set();
          catalog.set(depName, depTypes);
        }

        depTypes.add(depType);
      }
    }
  }

  return references;
}
