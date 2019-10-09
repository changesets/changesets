import { VersionType, PreState } from "@changesets/types";
import * as semver from "semver";

export function incrementVersion(
  version: string,
  versionType: VersionType,
  preState: PreState | undefined
) {
  return (
    semver.inc(version, versionType)! +
    // why are we adding this ourselves rather than passing 'pre' + versionType to semver.inc?
    // we want to make the prerelease version(the number at the end) across all packages the name
    (preState === undefined ? "" : `-${preState.tag}.${preState.version}`)
  );
}
