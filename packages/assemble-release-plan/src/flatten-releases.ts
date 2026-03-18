// This function takes in changesets and returns one release per
// package listed in the changesets

import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config, NewChangeset } from "@changesets/types";
import type { Package } from "@manypkg/get-packages";
import type { InternalRelease } from "./types.ts";
import { mapGetOrThrowInternal } from "./utils.ts";

export default function flattenReleases(
  changesets: NewChangeset[],
  packagesByName: Map<string, Package>,
  config: Config,
): Map<string, InternalRelease> {
  let releases: Map<string, InternalRelease> = new Map();

  changesets.forEach((changeset) => {
    changeset.releases
      // Filter out skipped packages because they should not trigger a release
      // If their dependencies need updates, they will be added to releases by `determineDependents()` with release type `none`
      .filter(({ name }) => {
        const pkg = mapGetOrThrowInternal(
          packagesByName,
          name,
          `Couldn't find package named "${name}" listed in changeset "${changeset.id}"`,
        );
        return !shouldSkipPackage(pkg, {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.version,
        });
      })
      .forEach(({ name, type }) => {
        let pkg = mapGetOrThrowInternal(
          packagesByName,
          name,
          `Couldn't find package named "${name}" listed in changeset "${changeset.id}"`,
        );
        let release = releases.get(name);
        if (!release) {
          release = {
            name,
            type,
            oldVersion: pkg.packageJson.version,
            changesets: [changeset.id],
          };
        } else {
          if (
            type === "major" ||
            ((release.type === "patch" || release.type === "none") &&
              (type === "minor" || type === "patch"))
          ) {
            release.type = type;
          }
          // Check whether the bumpType will change
          // If the bumpType has changed recalc newVersion
          // push new changeset to releases
          release.changesets.push(changeset.id);
        }

        releases.set(name, release);
      });
  });

  return releases;
}
