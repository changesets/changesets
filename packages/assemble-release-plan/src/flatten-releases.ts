import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  Config,
  NewChangeset,
  Package,
  VersionType,
} from "@changesets/types";
import type { InternalRelease } from "./types.ts";
import { mapGetOrThrowInternal } from "./utils.ts";

const changeTypes = {
  major: 3,
  minor: 2,
  patch: 1,
  none: 0,
} as const;

const changeTypeIsBiggerThanPrevious = (
  type: VersionType,
  previous: VersionType,
) => changeTypes[type] > changeTypes[previous];

/**
 * Flattens a list of changesets into a package->release-type map
 */
export function flattenReleases(
  changesets: NewChangeset[],
  packagesByName: Map<string, Package>,
  config: Config,
): Map<string, InternalRelease> {
  const releases: Map<string, InternalRelease> = new Map();

  // Iterate each changeset and its affected packages (`releases`)
  for (const changeset of changesets) {
    for (const { name, type } of changeset.releases) {
      const pkg = mapGetOrThrowInternal(
        packagesByName,
        name,
        `Couldn't find package named "${name}" listed in changeset "${changeset.id}"`,
      );

      // Filter out skipped packages because they should not trigger a release
      // If their dependencies need updates, they will be added to releases by `determineDependents()` with release type `none`
      const packageIsSkipped = shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      });
      if (packageIsSkipped) continue;

      const release = releases.get(name);

      if (release == null) {
        releases.set(name, {
          name,
          type,
          oldVersion: pkg.packageJson.version,
          changesets: [changeset.id],
        });

        continue;
      }

      if (changeTypeIsBiggerThanPrevious(type, release.type)) {
        release.type = type;
      }

      // Check whether the bumpType will change
      // If the bumpType has changed recalc newVersion
      // push new changeset to releases
      release.changesets.push(changeset.id);

      releases.set(name, release);
    }
  }

  return releases;
}
