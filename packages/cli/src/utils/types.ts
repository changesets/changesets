import { DEPENDENCY_TYPES } from "./constants";

export type BumpType = "major" | "minor" | "patch" | "none";

export type DependencyType = typeof DEPENDENCY_TYPES[number];

export type Changeset = {
  id: string;
  commit: string;
  summary: string;
  releases: Array<{ name: string; type: BumpType }>;
  dependents: Array<{ name: string; type: BumpType }>;
};
