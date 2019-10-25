import { PreState } from "@changesets/types";
import * as semver from "semver";
import { InternalRelease } from "./types";

export function incrementVersion(
  release: InternalRelease,
  preState: PreState | undefined
) {
  return (
    semver.inc(release.oldVersion, release.type)! +
    // why are we adding this ourselves rather than passing 'pre' + versionType to semver.inc?
    // we want to make the prerelease version(the number at the end) across all packages the name
    (preState === undefined || preState.mode === "exit"
      ? ""
      : `-${preState.tag}.${preState.version}`)
  );
}
