import * as semver from "semver";
import { InternalRelease, PreInfo } from "./types";
import { InternalError } from "@changesets/errors";

export function incrementVersion(
  release: InternalRelease,
  preInfo: PreInfo | undefined
): string {
  if (release.type === "none") {
    return release.oldVersion;
  }

  let version = semver.inc(release.oldVersion || "0.0.0", release.type);
  if (!version) {
    throw new Error(
      `Could not increment version ("${release.oldVersion}") for package "${release.name}"`
    );
  }
  if (preInfo !== undefined && preInfo.state.mode !== "exit") {
    let preVersion = preInfo.preVersions.get(release.name);
    if (preVersion === undefined) {
      throw new InternalError(
        `preVersion for ${release.name} does not exist when preState is defined`
      );
    }
    // why are we adding this ourselves rather than passing 'pre' + versionType to semver.inc?
    // because semver.inc with prereleases is confusing and this seems easier
    version += `-${preInfo.state.tag}.${preVersion}`;
  }
  return version;
}
