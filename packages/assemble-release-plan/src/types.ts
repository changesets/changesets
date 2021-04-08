import {
  VersionType,
  PreState,
  NewChangeset,
  Config,
  ReleasePlan
} from "@changesets/types";
import { Packages } from "@manypkg/get-packages";

export type InternalRelease = {
  name: string;
  type: VersionType;
  oldVersion: string;
  changesets: string[];
};

export type PreInfo = {
  state: PreState;
  preVersions: Map<string, number>;
};

export type AssembleReleasePlan = (
  changesets: NewChangeset[],
  packages: Packages,
  config: Config,
  preState: PreState | undefined,
  snapshot?: string | boolean | undefined
) => ReleasePlan;
