import type { ComprehensiveRelease, PreState } from "@changesets/types";

export type InternalRelease = Omit<
  ComprehensiveRelease,
  "oldVersion" | "newVersion"
> & {
  oldVersion: string;
};

export type PreInfo = {
  state: PreState;
  preVersions: Map<string, number>;
};
