import { ComprehensiveRelease, PackageJSON } from "@changesets/types";
import getVersionRangeType from "@changesets/get-version-range-type";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

export default async function versionPackage(
  release: ComprehensiveRelease & {
    changelog: string | null;
    config: PackageJSON;
    dir: string;
  },
  versionsToUpdate: Array<{ name: string; version: string }>
) {
  let { newVersion, config } = release;

  config.version = newVersion;

  for (let type of DEPENDENCY_TYPES) {
    if (config[type]) {
      versionsToUpdate.forEach(({ name, version }) => {
        // @ts-ignore I shan't be having with this config[type] might be undefined nonsense
        let depCurrentVersion = config[type][name];
        if (depCurrentVersion) {
          let rangeType = getVersionRangeType(depCurrentVersion);
          let newNewRange = `${rangeType}${version}`;
          // @ts-ignore I shan't be having with this config[type] might be undefined nonsense
          config[type][name] = newNewRange;
        }
      });
    }
  }

  return { ...release, config };
}
