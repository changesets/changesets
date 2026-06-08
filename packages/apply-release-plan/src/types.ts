import type { ModCompWithPackage } from "@changesets/types";

export type ModCompWithPackageAndChangelog = ModCompWithPackage & {
  changelog: string | null;
};
