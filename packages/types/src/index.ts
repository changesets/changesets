// NB: Bolt check uses a different dependnecy set to every other package.
// You need think before you use this.
const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type VersionType = "major" | "minor" | "patch" | "none";

export type DependencyType = typeof DEPENDENCY_TYPES[number];

export type AccessType = "public" | "restricted";

export type Release = { name: string; type: VersionType };

// This is a release that has been modified to include all relevant information
// about releasing - it is calculated and doesn't make sense as an artefact
export type ComprehensiveRelease = {
  name: string;
  type: VersionType;
  oldVersion: string;
  newVersion: string;
  changesets: string[];
};

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
  changelog: false | readonly [string, any];
  commit: false | readonly [string, any];
  fixed: Fixed;
  linked: Linked;
  access: AccessType;
  baseBranch: string;
  changedFilePatterns: readonly string[];
  /** When false, Changesets won't format with Prettier */
  prettier: boolean;
  /** Features enabled for Private packages */
  privatePackages: PrivatePackages;
  /** The minimum bump type to trigger automatic update of internal dependencies that are part of the same release */
  updateInternalDependencies: "patch" | "minor";
  ignore: ReadonlyArray<string>;
  /** This is supposed to be used with pnpm's `link-workspace-packages: false` and Berry's `enableTransparentWorkspaces: false` */
  bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: Omit<
    Required<ExperimentalOptions>,
    "useCalculatedVersionForSnapshots"
  >;
  snapshot: {
    useCalculatedVersion: boolean;
    prereleaseTemplate: string | null;
  };
};

export type WrittenConfig = {
  changelog?: false | readonly [string, any] | string;
  commit?: boolean | readonly [string, any] | string;
  fixed?: Fixed;
  linked?: Linked;
  access?: AccessType;
  baseBranch?: string;
  changedFilePatterns?: readonly string[];
  prettier?: boolean;
  /** Opt in to tracking non-npm / private packages */
  privatePackages?:
    | false
    | {
        version?: boolean;
        tag?: boolean;
      };
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
  /** @deprecated Since snapshot feature is now stable, you should migrate to use "snapshot.useCalculatedVersion". */
  useCalculatedVersionForSnapshots?: boolean;
};

export type NewChangesetWithCommit = NewChangeset & { commit?: string };

export type ModCompWithPackage = ComprehensiveRelease & {
  packageJson: PackageJSON;
  dir: string;
};

/**
 * The default type for changelog options that maintains backward compatibility.
 * Allows for either no options (`null`) or a flexible record of any options.
 *
 * @public
 */
export type DefaultChangelogOptions = null | Record<string, any>;

/**
 * Function type for generating a release line in a changelog.
 * This function is called for each changeset to generate its corresponding changelog entry.
 *
 * @param changeset - The {@link NewChangesetWithCommit} data including summary and optional commit information
 * @param type - The {@link VersionType} bump type (`"major"` | `"minor"` | `"patch"` | `"none"`)
 * @param changelogOpts - Configuration options for the changelog generator of type `ChangelogOptions`
 * @returns A promise that resolves to the formatted changelog line as a `string`
 *
 * @typeParam ChangelogOptions - The type of options passed to the changelog function. Defaults to {@link DefaultChangelogOptions}
 * @public
 */
export type GetReleaseLine<ChangelogOptions = DefaultChangelogOptions> = (
  changeset: NewChangesetWithCommit,
  type: VersionType,
  changelogOpts: ChangelogOptions
) => Promise<string>;

/**
 * Function type for generating dependency release lines in a changelog.
 * This function is called when dependencies are updated to generate their changelog entries.
 *
 * @param changesets - Array of {@link NewChangesetWithCommit} that caused the dependency updates
 * @param dependenciesUpdated - Array of {@link ModCompWithPackage} that had their dependencies updated
 * @param changelogOpts - Configuration options for the changelog generator of type `ChangelogOptions`
 * @returns A promise that resolves to the formatted dependency changelog lines as a `string`
 *
 * @typeParam ChangelogOptions - The type of options passed to the changelog function. Defaults to {@link DefaultChangelogOptions}
 * @public
 */
export type GetDependencyReleaseLine<
  ChangelogOptions = DefaultChangelogOptions
> = (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[],
  changelogOpts: ChangelogOptions
) => Promise<string>;

/**
 * Interface defining the required functions for a changelog generator.
 * This type can be parameterized with specific option types for better type safety.
 *
 * @typeParam ChangelogOptions - The type of options that will be passed to the changelog functions.
 *                              Defaults to {@link DefaultChangelogOptions} for backward compatibility.
 *
 * @example
 * For a changelog that expects specific options:
 * ```typescript
 * const myChangelog: ChangelogFunctions<{ repo: string; token?: string }> = {
 *   getReleaseLine: async (changeset, type, options) => {
 *     // options.repo is strongly typed as string
 *     // options.token is strongly typed as string | undefined
 *     return `- ${changeset.summary}`;
 *   },
 *   getDependencyReleaseLine: async (changesets, deps, options) => {
 *     return `Updated ${deps.length} dependencies`;
 *   }
 * };
 * ```
 *
 * @example
 * For a changelog that doesn't use options (backward compatible):
 * ```typescript
 * const simpleChangelog: ChangelogFunctions = {
 *   getReleaseLine: async (changeset, type) => `- ${changeset.summary}`,
 *   getDependencyReleaseLine: async () => ""
 * };
 * ```
 *
 * @public
 */
export type ChangelogFunctions<ChangelogOptions = DefaultChangelogOptions> = {
  getReleaseLine: GetReleaseLine<ChangelogOptions>;
  getDependencyReleaseLine: GetDependencyReleaseLine<ChangelogOptions>;
};

export type GetAddMessage = (
  changeset: Changeset,
  commitOptions: any
) => Promise<string>;

export type GetVersionMessage = (
  releasePlan: ReleasePlan,
  commitOptions: any
) => Promise<string>;

export type CommitFunctions = {
  getAddMessage?: GetAddMessage;
  getVersionMessage?: GetVersionMessage;
};

export type PreState = {
  mode: "pre" | "exit";
  tag: string;
  initialVersions: {
    [pkgName: string]: string;
  };
  changesets: string[];
};
