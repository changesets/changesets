import semver from "semver";
import { Linked, ComprehensiveRelease } from "@changesets/types";

/*
  WARNING:
  Important note for understanding how this package works:

  We are doing some kind of wacky things with manipulating the objects within the
  releases array, despite the fact that this was passed to us as an argument. We are
  aware that this is generally bad practice, but have decided to to this here as
  we control the entire flow of releases.

  We could solve this by inlining this function, or by returning a deep-cloned then
  modified array, but we decided both of those are worse than this solution.
*/
function applyLinks(releases: ComprehensiveRelease[], linked: Linked): boolean {
  let updated = false;
  if (!linked) return updated;

  // We do this for each set of linked packages
  for (let linkedPackages of linked) {
    // First we filter down to all the relevent releases for one set of linked packages
    let releasingLinkedPackages = releases.filter(release =>
      linkedPackages.includes(release.name)
    );

    let highestVersion;
    // Next we determine what the highest version among the linked packages will be
    for (let linkedPackage of releasingLinkedPackages) {
      let version = linkedPackage.newVersion;
      if (highestVersion === undefined || semver.gt(version, highestVersion)) {
        highestVersion = version;
      }
    }
    // Finally, we update the packages so all of them are on the highest version
    for (let linkedPackage of releasingLinkedPackages) {
      if (highestVersion && linkedPackage.newVersion !== highestVersion) {
        updated = true;
        linkedPackage.newVersion = highestVersion;
      }
    }
  }

  return updated;
}

export default applyLinks;
