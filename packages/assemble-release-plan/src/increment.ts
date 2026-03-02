import semverInc from "semver/functions/inc";
import { InternalRelease, PreInfo } from "./types";
import { mapGetOrThrowInternal } from "./utils";

export function incrementVersion(
  release: InternalRelease,
  preInfo: PreInfo | undefined
) {
  if (release.type === "none") {
    return release.oldVersion;
  }

  let version = semverInc(release.oldVersion, release.type)!;
  if (preInfo !== undefined && preInfo.state.mode !== "exit") {
    let preVersion = mapGetOrThrowInternal(
      preInfo.preVersions,
      release.name,
      `preVersion for ${release.name} does not exist when preState is defined`
    );
    // why are we adding this ourselves rather than passing 'pre' + versionType to semver.inc?
    // because semver.inc with prereleases is confusing and this seems easier
    version += `-${preInfo.state.tag}.${preVersion}`;
  }
  return version;
}
