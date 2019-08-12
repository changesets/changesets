import { VersionType } from "@changesets/types";

export type InternalRelease = {
  name: string;
  type: VersionType;
  oldVersion: string;
  changesets: string[];
};
