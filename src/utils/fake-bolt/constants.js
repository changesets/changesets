// @flow
export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "bundledDependencies",
  "optionalDependencies"
];

export const DEPENDENCY_TYPE_FLAGS_MAP = {
  dev: "devDependencies",
  peer: "peerDependencies",
  optional: "optionalDependencies",
  D: "devDependencies",
  P: "peerDependencies",
  O: "optionalDependencies"
};
