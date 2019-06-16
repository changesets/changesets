import { DEPENDENCY_TYPES } from "../constants";
import { DependencyType, PackageJSON } from "@changesets/types";

export function getDependencyTypes(depName: string, config: PackageJSON) {
  const matchedTypes = [];
  for (const depType of DEPENDENCY_TYPES) {
    const deps = getDeps(depType, config);
    if (deps && deps[depName]) {
      matchedTypes.push(depType);
    }
  }
  return matchedTypes;
}

export function getDependencyVersionRange(
  depName: string,
  config: PackageJSON
) {
  for (const depType of DEPENDENCY_TYPES) {
    const deps = getDeps(depType, config);
    if (deps && deps[depName]) {
      return deps[depName];
    }
  }
  return null;
}

function getDeps(depType: DependencyType, config: PackageJSON) {
  const deps = config[depType];
  if (typeof deps === "undefined") return;
  return deps;
}
