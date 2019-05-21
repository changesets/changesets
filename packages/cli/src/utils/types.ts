export type BumpType = "major" | "minor" | "patch" | "none";

export type Changeset = {
  id: string;
  commit: string;
  summary: string;
  releases: Array<{ name: string; type: BumpType }>;
  dependents: Array<{ name: string; type: BumpType }>;
};
