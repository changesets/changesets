// This function takes in changesets and returns one release per
// package listed in the changesets

import { NewChangeset } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import { InternalRelease } from "./types";

export default function flattenReleases(
  changesets: NewChangeset[],
  packagesByName: Map<string, Package>
): Map<string, InternalRelease> {
  let releases: Map<string, InternalRelease> = new Map();

  changesets.forEach(changeset => {
    changeset.releases.forEach(({ name, type }) => {
      let release = releases.get(name);
      let pkg = packagesByName.get(name);
      if (!pkg) {
        throw new Error(`Could not find package information for ${name}`);
      }
      if (!release) {
        release = {
          name,
          type,
          oldVersion: pkg.packageJson.version,
          changesets: [changeset.id]
        };
      } else {
        // If the type was already major, we never need to update it
        if (release.type === "minor" && type === "major") {
          release.type = type;
        } else if (
          release.type === "patch" &&
          (type === "major" || type === "minor")
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
