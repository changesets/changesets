import path from "path";

export const pkgPath = path.dirname(
  require.resolve("@changesets/cli/package.json")
);

export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;
