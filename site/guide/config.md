# Configuration File

Changesets keeps its configuration in `.changeset/config.json`. The default config is:

```json [.changeset/config.json]
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "changedFilePatterns": ["**"],
  "format": "auto",
  "privatePackages": { "version": true, "tag": false },
  "updateInternalDependencies": "patch",
  "ignore": [],
  "bumpVersionsWithWorkspaceProtocolOnly": false
}
```

## changelog

- **Type:** `false | string | [string, Record<string, any>]`
- **Default:** `"@changesets/cli/changelog"`

Set how the changelog for packages should be generated. The default changelog generator is `@changesets/cli/changelog` (an alias to `@changesets/changelog-git`) which adds related commit links to each changeset entry in the changelog. If it is set to `false`, no changelogs will be generated.

You can also specify a custom changelog generator by providing a string or a tuple with the module path and options. The module can be an npm package or a relative file path. Check out the [Customize Changelog Format](./customize-changelog-format.md) guide to learn how to write your own changelog generator.

If a tuple (`[string, Record<string, any>]`) is set, you can pass options in the second item of the tuple to configure the changelog generator. For example, if you are using `@changesets/changelog-github`, you can pass the `repo` options like this:

```json [.changeset/config.json]
{
  "changelog": ["@changesets/changelog-github", { "repo": "owner/repo" }]
}
```

Consult the documentation for the changelog generator you're using for more information on the options you can pass to it.

Read more about the [`@changesets/changelog-github` package](/packages/changelog-github).

## commit

- **Type:** `boolean | string | [string, Record<string, any>]`
- **Default:** `false`

Enable this option to automatically commit the changes when running the `changeset add` and `changeset version` commands. If set to `true`, the default commit message generator (`["@changesets/cli/commit", { "skipCI": "version" }]`) will be used.

This option works similarly to the [`changelog`](#changelog) option. Check out the [Customize Commit Format](./customize-commit-format.md) guide to learn how to write your own commit message generator.

## fixed

- **Type:** `string[][]`
- **Default:** `[]`
- **Related:** [Fixed Packages](./fixed-packages.md)
- **Note:** Only applicable in monorepos.

Declare that packages should be version-bumped and published together. Supports [picomatch patterns](https://github.com/micromatch/picomatch) to match packages.

For example, if you have `pkg-a@1.0.0` and `pkg-b@1.0.0`, when one gets bumped to `1.1.0`, the other is also bumped to `1.1.0` regardless if it has any change or not. To achieve this, you can configure like so:

```json [.changeset/config.json]
{
  "fixed": [["pkg-a", "pkg-b"], ["@scope/*"]]
}
```

Learn more about the implementation and implications in the [Fixed Packages](./fixed-packages.md) guide.

## linked

- **Type:** `string[][]`
- **Default:** `[]`
- **Related:** [Linked Packages](./linked-packages.md)
- **Note:** Only applicable in monorepos.

Declare that packages should "share" a version together. Supports [picomatch patterns](https://github.com/micromatch/picomatch) to match packages.

For example, if you have `pkg-a@1.0.0` and `pkg-b@1.1.0`, if `pkg-a` is minor-bumped, it uses the shared highest version in the group which is `1.1.0` and bumps to `1.2.0`. `pkg-b` will not be explicitly bumped. To achieve this, you can configure like so:

```json [.changeset/config.json]
{
  "linked": [["pkg-a", "pkg-b"], ["@scope/*"]]
}
```

Learn more about the implementation and implications in the [Linked Packages](./linked-packages.md) guide.

::: warning This does not do what some other tools do

If you want to ensure the packages are always published with the same version, use the [`fixed`](#fixed) option instead.

:::

## access

- **Type:** `"restricted" | "public"`
- **Default:** `"restricted"`

Sets how packages are published. If `access: "restricted"`, packages will be published as private, requiring log in to an npm account with access to install. If `access: "public"`, the packages will be made available on the public registry.

By default, npm publishes scoped npm packages as `restricted`, so to ensure you do not accidentally publish code publicly, we default to `restricted`. For most cases you will want to set this to `public`.

This can be overridden in specific packages by setting `"publishConfig": { "access": "..." }` in a package's `package.json`.

If you want to prevent a package from being published to npm, set `"private": true` in that package's `package.json`

## baseBranch

- **Type:** `string`
- **Default:** `"main"`

The branch to which Changesets will make comparisons to detect what has changed since the last commit of the base branch. This should generally be set to the default branch you merge changes into, e.g. `main` or `master`.

Commands that use this information accept a `--since` option which can be used to override this.

Locally, make sure the base branch exists and is up to date so Changesets can make accurate comparisons.

## changedFilePatterns

- **Type:** `string[]`
- **Default:** `["**"]`

The [picomatch patterns](https://github.com/micromatch/picomatch) for changed files that should mark a package as changed. Useful to fine-tune what counts as a change (e.g. only source files, ignoring test files, etc).

Example:

```json [.changeset/config.json]
{
  "changedFilePatterns": ["src/**", "lib/**"]
}
```

## format

- **Type:** `"auto" | "prettier" | "oxfmt" | "deno" | "dprint" | false`
- **Default:** `"auto"`

The code formatter to use for generated changeset files and changelogs. If set to `false`, no formatting will be applied.

In `"auto"` mode, Changesets uses [@changesets/format](https://github.com/changesets/format) to automatically detect the preferred code formatter used in the project and applies it to generated files. You can explicitly set the formatter if you have multiple formatters set up in your project.

## privatePackages

- **Type:** `{ version?: boolean; tag?: boolean } | false`

Controls how private packages should be versioned and tagged. By default, Changesets will update the version for private packages but will not create a tag.

### privatePackages.version

- **Type:** `boolean`
- **Default:** `true`

Whether to update the version of private packages when running `changeset version`.

### privatePackages.tag

- **Type:** `boolean`
- **Default:** `false`

Whether to create a tag for private packages when running `changeset publish`.

## updateInternalDependencies

- **Type:** `"patch" | "minor"`
- **Default:** `"patch"`
- **Note:** Only applicable in monorepos.

Controls how internal dependencies should be updated when the depended-upon package is updated. To make this more understandable, here is an example:

Say we have two packages, one depending on the other:

```
pkg-a @ version 1.0.0
pkg-b @ version 1.0.0
  depends on pkg-a at range ^1.0.0
```

And we are publishing a patch of both `pkg-a` and `pkg-b`. If the option is set to `patch`, we will update the pkg-a dependency range so we will now have:

```
pkg-a @ version 1.0.1
pkg-b @ version 1.0.1
  depends on pkg-a at range ^1.0.1 <-- updated
```

However, if the option is set to `minor`, the range will only be updated when there is a minor change:

```
pkg-a @ version 1.0.1
pkg-b @ version 1.0.1
  depends on pkg-a at range ^1.0.0 <-- not updated
```

Using `minor` allows consumers to more actively control their own deduplication of packages, and will allow them to install fewer versions if you have many interconnected packages. Using `patch` will mean consumers will more often be using updated code, but may cause problems with deduplication.

Changesets will always update the dependency range if it would leave the old semver range.

::: warning

The dependency range will only be updated if the package (that contains the dependency) is being released. For example, if `pkg-b` depends on `pkg-a`, and only `pkg-a` is released, the dependency range in `pkg-b` will not be updated.

:::

## ignore

- **Type:** `string[]`
- **Default:** `[]`
- **Note:** Only applicable in monorepos.

Specify the packages that will not be published, even if they are referenced in changesets. Instead, those changesets will be skipped until they are removed from this array. Supports [picomatch patterns](https://github.com/micromatch/picomatch) to match packages.

::: warning For temporary use only

This feature is designed for temporary use to allow changes to be merged without publishing them. If you want to stop a package from being published at all, set `"private": true` in its `package.json`.

:::

There are two caveats to this:

1. If the package is mentioned in a changeset that also includes a package that is not ignored, publishing will fail.
2. If the package requires one of its dependencies to be updated as part of a publish, publishing will also fail.

These restrictions exist to ensure your repository or published code do not end up in a broken state.

## bumpVersionsWithWorkspaceProtocolOnly

- **Type:** `boolean`
- **Default:** `false`
- **Note:** Only applicable in monorepos.

Whether to only bump dependency ranges that use the `workspace:` protocol of packages that are part of the workspace.

## snapshot

- **Type:** `{ useCalculatedVersion?: boolean; prereleaseTemplate?: string }`

Configure snapshot releases when using `changesets version --snapshot`.

### snapshot.useCalculatedVersion

- **Type:** `boolean`
- **Default:** `false`

Snapshot version uses `0.0.0` as the base version, e.g. `0.0.0-tag-20211213000730`, so it does not hinder with other version releases. For example, if you have a prerelease at `1.0.0-beta.0`, and then you had a snapshot prerelease at `1.0.0-tag-20211213000730`, and a consumer is using the range `^1.0.0-beta.0` would resolve to the snapshot version which is likely not expected. Using `0.0.0` solves this problem.

If this problem doesn't affect you, set this to `true` to use the calculated version based on the changeset files.

### snapshot.prereleaseTemplate

- **Type:** `string`
- **Default:** `"{tag}-{datetime}"` (or `"{datetime}"` if the tag is empty)

Configures the suffix for the snapshot release using a template with placeholders:

- `{tag}` - the name of the snapshot tag, as specified in `--snapshot something`
- `{commit}` - the git commit SHA (40 characters)
- `{commit-short}` - like `{commit}` but only the first 7 characters
- `{timestamp}` - the Unix timestamp of the time of the release, i.e. the value of `Date.now()`
- `{datetime}` - the date and time of the release, e.g. `20211213000730` (YYYYMMDDHHMMSS, 14 characters)

::: warning
If you are using `--snapshot` with empty tag name, you cannot use `{tag}` as a placeholder. This will result in an error.
:::

## \_\_\_experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH

Experimental options that may change in patch versions. Use these with caution and pay attention to the release notes for any changes.

### \_\_\_experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents

- **Type:** `"out-of-range" | "always"`
- **Default:** `"out-of-range"`

Add dependent packages to the release (if they are not already a part of it) with patch bumps.

### \_\_\_experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange

- **Type:** `boolean`
- **Default:** `false`

When set to `true`, Changesets will only bump peer dependents when `peerDependencies` are leaving the range.
