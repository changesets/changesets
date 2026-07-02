import type {
  ModCompWithPackage,
  NodeVersionProviderOptions,
  Package,
  RubyVersionProviderOptions,
  VersionType,
} from "@changesets/types";

export type ModCompWithPackageAndChangelog = ModCompWithPackage & {
  changelog: string | null;
};

export type VersionedFile = {
  path: string;
  content: string;
};

export type VersionToUpdate = {
  name: string;
  version: string;
  oldVersion: string;
  type: VersionType;
  dir: string;
};

export type VersionProviderPackageContext = {
  pkg: Package;
  cwd: string;
};

export type VersionProviderContext = VersionProviderPackageContext & {
  release: ModCompWithPackageAndChangelog;
  versionsToUpdate: VersionToUpdate[];
  updateInternalDependencies: "patch" | "minor";
  onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  snapshot?: string | boolean | undefined;
};

export type ResolvedVersionProviderOptions =
  | NodeVersionProviderOptions
  | RubyVersionProviderOptions;

export interface VersionProvider {
  type: ResolvedVersionProviderOptions["type"];
  detect(context: VersionProviderPackageContext): boolean | Promise<boolean>;
  getCurrentVersion(
    context: VersionProviderPackageContext,
    options: ResolvedVersionProviderOptions,
  ): string | undefined | Promise<string | undefined>;
  getVersionedFiles(
    context: VersionProviderContext,
    options: ResolvedVersionProviderOptions,
  ): Promise<VersionedFile[]>;
}
