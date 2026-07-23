type MaybePromise<T> = T | Promise<T>;

export type VersionType = "major" | "minor" | "patch" | "none";

// NB: Bolt check uses a different dependency set to every other package.
// You need think before you use this.
export type DependencyType =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

export type AccessType = "public" | "restricted";

export type Release = { name: string; type: VersionType };

interface ComprehensiveReleaseBase {
  name: string;
  type: "major" | "minor" | "patch" | "none";
  changesets: string[];
  oldVersion: string | undefined;
  newVersion: string | undefined;
}

interface ComprehensiveMajorRelease extends ComprehensiveReleaseBase {
  type: "major";
  oldVersion: string;
  newVersion: string;
}

interface ComprehensiveMinorRelease extends ComprehensiveReleaseBase {
  type: "minor";
  oldVersion: string;
  newVersion: string;
}

interface ComprehensivePatchRelease extends ComprehensiveReleaseBase {
  type: "patch";
  oldVersion: string;
  newVersion: string;
}

interface ComprehensiveNoneRelease extends ComprehensiveReleaseBase {
  type: "none";
  // Unversioned private packages only enter a release plan to have their dependencies updated.
  oldVersion: string | undefined;
  newVersion: string | undefined;
}

// This is a release that has been modified to include all relevant information
// about releasing - it is calculated and doesn't make sense as an artefact
export type ComprehensiveRelease =
  | ComprehensiveMajorRelease
  | ComprehensiveMinorRelease
  | ComprehensivePatchRelease
  | ComprehensiveNoneRelease;

export type Changeset = {
  summary: string;
  releases: Array<Release>;
};

export type NewChangeset = Changeset & {
  id: string;
};

export type ReleasePlan = {
  changesets: NewChangeset[];
  releases: ComprehensiveRelease[];
  preState: PreState | undefined;
};

export type PackageJSON = {
  name: string;
  version: string;
  dependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
  resolutions?: { [key: string]: string };
  private?: boolean;
  publishConfig?: {
    access?: AccessType;
    directory?: string;
    registry?: string;
    [registry: `${string}:registry`]: string;
  };
};

export type PackageGroup = ReadonlyArray<string>;

export type Fixed = ReadonlyArray<PackageGroup>;
export type Linked = ReadonlyArray<PackageGroup>;

export interface PrivatePackages {
  version: boolean;
  tag: boolean;
}

export type Config = {
  changelog: false | readonly [string, null | Record<string, unknown>];
  commit: false | readonly [string, null | Record<string, unknown>];
  fixed: Fixed;
  linked: Linked;
  access: AccessType;
  baseBranch: string;
  changedFilePatterns: readonly string[];
  /**
   * The formatter to use to format changesets and changelogs. Set `false` to disable formatting.
   * The default value of `"auto"` will auto-detect the formatter based on the project's configuration files.
   */
  format: "auto" | "prettier" | "oxfmt" | "deno" | "dprint" | false;
  /** Features enabled for Private packages */
  privatePackages: PrivatePackages;
  /** Stage packages for approval instead of publishing them immediately. */
  stagedPublishing?: boolean;
  /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
  updateInternalDependencies: "patch" | "minor";
  ignore: ReadonlyArray<string>;
  /** This is supposed to be used with pnpm's `link-workspace-packages: false` and Berry's `enableTransparentWorkspaces: false` */
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: Required<ExperimentalOptions>;
  snapshot: {
    useCalculatedVersion: boolean;
    prereleaseTemplate: string | null;
  };
};

export type WrittenConfig = {
  changelog?:
    | false
    | readonly [string, null | Record<string, unknown>]
    | string;
  commit?: boolean | readonly [string, null | Record<string, unknown>] | string;
  fixed?: Fixed;
  linked?: Linked;
  access?: AccessType;
  baseBranch?: string;
  changedFilePatterns?: readonly string[];
  format?: "auto" | "prettier" | "oxfmt" | "deno" | "dprint" | false;
  /** Opt in to tracking non-npm / private packages */
  privatePackages?:
    | false
    | {
        version?: boolean;
        tag?: boolean;
      };
  /** Stage packages for approval instead of publishing them immediately. */
  stagedPublishing?: boolean;
  /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
  updateInternalDependencies?: "patch" | "minor";
  ignore?: ReadonlyArray<string>;
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  snapshot?: {
    useCalculatedVersion?: boolean;
    prereleaseTemplate?: string;
  };
  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH?: ExperimentalOptions;
};

export type ExperimentalOptions = {
  onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
  updateInternalDependents?: "always" | "out-of-range";
};

export type NewChangesetWithCommit = NewChangeset & { commit?: string };

export type ModCompWithPackage = ComprehensiveRelease & {
  packageJson: PackageJSON;
  dir: string;
};

export type GetReleaseLine = (
  changeset: NewChangesetWithCommit,
  type: VersionType,
  changelogOpts: null | Record<string, unknown>,
) => MaybePromise<string>;

export type GetDependencyReleaseLine = (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[],
  changelogOpts: null | Record<string, unknown>,
) => MaybePromise<string>;

export type ChangelogFunctions = {
  getReleaseLine: GetReleaseLine;
  getDependencyReleaseLine: GetDependencyReleaseLine;
};

export type GetAddMessage = (
  changeset: Changeset,
  commitOpts: null | Record<string, unknown>,
) => MaybePromise<string>;

export type GetVersionMessage = (
  releasePlan: ReleasePlan,
  commitOpts: null | Record<string, unknown>,
) => MaybePromise<string>;

export type CommitFunctions = {
  getAddMessage?: GetAddMessage;
  getVersionMessage?: GetVersionMessage;
};

export type PreState = {
  mode: "pre" | "exit";
  tag: string;
  changesets: string[];
};

export interface Package {
  dir: string;
  packageJson: PackageJSON;
}

export interface Packages {
  rootDir: string;
  rootPackage?: Package;
  packages: Array<Package>;
  tool: {
    type: "yarn" | "pnpm" | "lerna" | "bolt" | "root" | (string & {});
  };
}
