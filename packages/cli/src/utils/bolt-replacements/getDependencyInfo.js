import { DEPENDENCY_TYPES } from "../constants";

export function getDependencyTypes(depName, config) {
  const matchedTypes = [];
  for (const depType of DEPENDENCY_TYPES) {
    const deps = getDeps(depType, config);
    if (deps && deps[depName]) {
      matchedTypes.push(depType);
    }
  }
  return matchedTypes;
}

export function getDependencyVersionRange(depName, config) {
  for (const depType of DEPENDENCY_TYPES) {
    const deps = getDeps(depType, config);
    if (deps && deps[depName]) {
      return deps[depName];
    }
  }
  return null;
}

function getDeps(depType, config) {
  const deps = config[depType];
  if (typeof deps === "undefined") return;
  return deps;
}
