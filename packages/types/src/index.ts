const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

export type BumpType = "major" | "minor" | "patch" | "none";

export type DependencyType = typeof DEPENDENCY_TYPES[number];

export type Release = { name: string; type: BumpType };

export type Changeset = {
  id: string;
  commit?: string;
  summary: string;
  releases: Array<Release>;
  dependents: Array<Release>;
};

export type NewChangeset = {
  id: string;
  summary: string;
  releases: Array<Release>;
};

export type PackageJSON = {
  name: string;
  version: string;
  dependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
};

export type Workspace = { config: PackageJSON; name: string; dir: string };
