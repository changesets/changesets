import { Groups, VersionType } from "@changesets/types";
import { InternalRelease } from "./types";
import { Package } from "@manypkg/get-packages";

type Source = string;
type Target = string;

function shouldUpdateBumpType(current: string, incoming: string): boolean {
  const order = ["none", "patch", "minor", "major"];
  return order.indexOf(incoming) > order.indexOf(current);
}

function getHigherBumpType(a: VersionType, b: VersionType): VersionType {
  const order = ["none", "patch", "minor", "major"] as VersionType[];
  return order[Math.max(order.indexOf(a), order.indexOf(b))] as VersionType;
}

export default function applyGroups(
  releases: Map<string, InternalRelease>,
  packagesByName: Map<string, Package>,
  groups: Groups
): boolean {
  let updated = false;

  // Create a map: source -> targets
  const sourceToTargets = new Map<Source, Target[]>();

  for (const [source, target] of groups) {
    if (!sourceToTargets.has(source)) {
      sourceToTargets.set(source, []);
    }
    sourceToTargets.get(source)!.push(target);
  }

  // Propagate source bumps to targets (one-way)
  for (const [sourcePkg, sourceRelease] of releases) {
    if (sourceRelease.type === "none") continue;

    const targets = sourceToTargets.get(sourcePkg);
    if (!targets) continue;

    for (const targetPkg of targets) {
      const existingTargetRelease = releases.get(targetPkg);

      if (!existingTargetRelease) {
        // Create new release for target based on source bump
        const targetPackage = packagesByName.get(targetPkg);
        if (targetPackage) {
          releases.set(targetPkg, {
            name: targetPkg,
            type: sourceRelease.type,
            oldVersion: targetPackage.packageJson.version,
            changesets: [...sourceRelease.changesets],
          });
          updated = true;
        }
      } else if (
        shouldUpdateBumpType(existingTargetRelease.type, sourceRelease.type)
      ) {
        // Update to higher bump type if source dictates a higher bump
        existingTargetRelease.type = getHigherBumpType(
          existingTargetRelease.type,
          sourceRelease.type
        );
        existingTargetRelease.changesets = [
          ...new Set([
            ...existingTargetRelease.changesets,
            ...sourceRelease.changesets,
          ]),
        ];
        updated = true;
      }
    }
  }

  return updated;
}
