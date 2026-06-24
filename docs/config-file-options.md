# Configuring Changesets

Changesets has a minimal amount of configuration options. Mostly these are for when you need to change the default workflows. These are stored in `.changeset/config.json`. Our default config is:

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "master",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "bumpVersionsWithWorkspaceProtocolOnly": false,
  "changedFilePatterns": ["**"],
  "format": "auto",
  "privatePackages": { "version": true, "tag": false }
}
```

> NOTE: the `linked`, `fixed`, `updateInternalDependencies`, `bumpVersionsWithWorkspaceProtocolOnly`, and `ignore` options are only for behaviour in monorepos.

## `commit` (`boolean`, or module path as a `string`, or a tuple like `[modulePath: string, options: any]`)

This option is for setting if the `changeset add` command and the `changeset version` commands will also add and commit the changed files using git, and how the commit messages should be generated for them.

By default, we do not commit the files, and leave it to the user to commit the files. If it is `true`, we use the default commit message generator (`["@changesets/cli/commit", { "skipCI": "version" }]`). Setting it to a string and options tuple specifies a path from where we will load the commit message generation functions. It expects to be a file that exports one or both of the following:

```
{
  getAddMessage,
  getVersionMessage
}
```

If one of the methods is not present then we will not commit the files changed for that command.

You would specify a custom commit message generator with:

```json
{
  "commit": ["../scripts/commit.js", { "customOption": true }]
}
```

This is similar to how the [changelog generator functions work](#changelog-false-or-a-path).

## `access` (`restricted` | `public`)

This sets how packages are published - if `access: "restricted"`, packages will be published as private, requiring log in to an npm account with access to install. If `access: "public"`, the packages will be made available on the public registry.

By default, npm publishes scoped npm packages as `restricted` - so to ensure you do not accidentally publish code publicly, we default to `restricted`. For most cases you will want to set this to `public`.

This can be overridden in specific packages by setting the `access` in a package's `package.json`.

If you want to prevent a package from being published to npm, set `private: true` in that package's `package.json`

## `baseBranch` (git branch name)

The branch to which changesets will make comparisons to detect what has changed since the last commit of the base branch. This should generally be set to the default branch you merge changes into, e.g. `main` or `master`.

Commands that use this information accept a `--since` option which can be used to override this.

Locally, make sure the base branch exists and is up to date so changesets can make accurate comparisons.

## `ignore` (array of packages)

This option allows you to specify some packages that will not be published, even if they are referenced in changesets. Instead, those changesets will be skipped until they are removed from this array.

> THIS FEATURE IS DESIGNED FOR TEMPORARY USE TO ALLOW CHANGES TO BE MERGED WITHOUT PUBLISHING THEM - If you want to stop a package from being published at all, set `private: true` in its `package.json`.

There are two caveats to this.

1. If the package is mentioned in a changeset that also includes a package that is not ignored, publishing will fail.
2. If the package requires one of its dependencies to be updated as part of a publish.

These restrictions exist to ensure your repository or published code do not end up in a broken state. For a more detailed intricacies of publishing, check out our guide on [problems publishing in monorepos](./problems-publishing-in-monorepos.md).

> NOTE: you can also provide glob expressions to match the packages, according to the [picomatch](https://npmx.dev/picomatch) format.

## `fixed` (array of arrays of package names)

This option can be used to declare that packages should be version-bumped and published together. As an example, if you have a `@changesets/button` component and a `@changesets/theme` component and you want to make sure that when one gets bumped to `1.1.0`, the other is also bumped to `1.1.0` regardless if it has any change or not. To achieve this you would have the config:

```json
{
  "fixed": [["@changesets/button", "@changesets/theme"]]
}
```

If you want to use this option, you should read the documentation on [fixed packages](./fixed-packages.md) to fully understand the implementation and implications.

## `linked` (array of arrays of package names)

This option can be used to declare that packages should 'share' a version, instead of being versioned completely independently. As an example, if you have a `@changesets/button` component and a `@changesets/theme` component and you want to make sure that when one gets bumped to `2.0.0`, the other is also bumped to `2.0.0`. To achieve this you would have the config:

```json
{
  "linked": [["@changesets/button", "@changesets/theme"]]
}
```

If you want to use this option, you should read the documentation on [linked packages](./linked-packages.md) to fully understand the implementation and implications.

> NOTE: This does not do what some other tools do, which is make sure when any package is published, all other packages are also published with the same version.

## `updateInternalDependencies`

This option sets whether, when a package that is being depended upon changes, whether you should update what version it depends on. To make this more understandable, here is an example:

Say we have two packages, one depending on the other:

```
pkg-a @ version 1.0.0
pkg-b @ version 1.0.0
  depends on pkg-a at range `^1.0.0
```

Say we are publishing a patch of both `pkg-a` and `pkg-b` - this flag is for determining whether we update how `pkg-b` depends on `pkg-a`.

If the option is set to `patch`, we will update the dependency so we will now have:

```
pkg-a @ version 1.0.1
pkg-b @ version 1.0.1
  depends on pkg-a at range `^1.0.1
```

If however the option is set to `minor`, what it depends on will only be updated when there is a minor change, so the state would be:

```
pkg-a @ version 1.0.1
pkg-b @ version 1.0.1
  depends on pkg-a at range `^1.0.0
```

Using `minor` allows consumers to more actively control their own deduplication of packages, and will allow them to install fewer versions if you have many interconnected packages. Using `patch` will mean consumers will more often be using more updated code, but may cause problems with deduplication.

Changesets will always update the dependency if it would leave the old semver range.

> ⚠ Note: this is only applied for packages which are already released in the current release. If A depends on B and we only release B then A won't be bumped.

## `changelog` (false or a path)

This option is for setting how the changelog for packages should be generated. If it is `false`, no changelogs will be generated. Setting it to a string specifies a path from where we will load the changelog generation functions. It expects a file that exports the following:

```
{
  getReleaseLine,
  getDependencyReleaseLine
}
```

As well as the default one, you can use `@changesets/changelog-git`, which adds links to commits into changelogs, or `@changesets/changelog-github`, which requires github authentication, and includes a thankyou message to the person who added the changeset as well as a link to the relevant PR.

You would specify our github changelog generator with:

```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "<org>/<repo>" }]
}
```

If you want to disable thank you messages, add `"disableThanks": true` to the options.

For more details on these functions and information on how to write your own see [changelog-functions](./modifying-changelog-format.md)

## `bumpVersionsWithWorkspaceProtocolOnly` (optional boolean)

Default value: `false`

Determines whether Changesets should only bump dependency ranges that use workspace protocol of packages that are part of the workspace.

## `snapshot` (object or undefined)

Default value: `undefined`

### `useCalculatedVersion` (optional boolean)

Default value: `false`

When `changesets version --snapshot` is used, the default behavior is to use `0.0.0` as the base version for the snapshot release.

Setting `useCalculatedVersion: true` will change the default behavior and will use the calculated version, based on the changeset files.

### `prereleaseTemplate` (optional string)

Default value: `undefined` (see note below)

Configures the suffix for the snapshot releases, using a template with placeholders.

**Available placeholders:**

You can use the following placeholders for customizing the snapshot release version:

- `{tag}` - the name of the snapshot tag, as specified in `--snapshot something`
- `{commit}` - the Git commit ID
- `{timestamp}` - Unix timestamp of the time of the release
- `{datetime}` - date and time of the release (14 characters, for example, `20211213000730`)

> Note: if you are using `--snapshot` with empty tag name, you cannot use `{tag}` as placeholder - this will result in error.

**Default behavior**

If you are not specifying `prereleaseTemplate`, the default behavior will fall back to using the following template: `{tag}-{datetime}`, and in cases where the tag is empty (`--snapshot` with no tag name), it will use `{datetime}` only.

## `prettier` (optional boolean)

This option configures whether Changesets will format its output using Prettier. When set to `false`, Changesets will skip formatting with Prettier.

Default value: `true`

```json
{
  "prettier": false
}
```

## `privatePackages` (object or false)

This option is for setting how private packages should be handled. By default, Changesets will update the changelog for private packages and update their version, but will not create a tag. You can configure this option to change the default behavior.

### `version` (optional boolean)

Default value: `true`

When `version` is set to `true`, Changesets will update the version for private packages. If set to `false`, Changesets will not update the version for private packages.

### `tag` (optional boolean)

Default value: `false`

When `tag` is set to `true`, Changesets will create a tag for private packages. If set to `false`, Changesets will not create a tag for private packages.

### Example

```json
{
  "privatePackages": {
    "version": true,
    "tag": false
  }
}
```

## `versionProvider` (`"node"` | `"ruby"` | object)

This option controls which provider reads and updates version files when `changeset version` applies a release plan. When unset, Changesets uses automatic provider selection.

The `node` provider updates the package's `package.json` version and npm dependency ranges. This is the historical Changesets behavior.

The `ruby` provider reads the current version from Ruby version files and updates them when they exist:

- `lib/<gem-name>/version.rb` or a single discovered `lib/**/version.rb`
- `<gem-name>.gemspec` or a single discovered root `*.gemspec`
- `Gemfile.lock`

When `versionProvider` is unset, Changesets selects the Ruby provider if it finds Ruby version files in the package directory. Otherwise it uses the Node provider. Package-specific entries in `packages` take precedence over the default provider.

You can configure a single provider for every package:

```json
{
  "versionProvider": "ruby"
}
```

For mixed repositories, configure a default and package-specific overrides:

```json
{
  "versionProvider": {
    "packages": {
      "my-gem": {
        "type": "ruby",
        "gemName": "my-gem",
        "versionFile": "lib/my_gem/version.rb",
        "gemspec": "my-gem.gemspec",
        "gemfileLock": "Gemfile.lock"
      }
    }
  }
}
```

Set `versionFile`, `gemspec`, or `gemfileLock` to `false` to skip that Ruby file.

### Ruby provider options

- `type`: must be `"ruby"`.
- `gemName`: the Ruby gem name used to find `<gem-name>.gemspec`, `lib/<gem-name>/version.rb`, and the `Gemfile.lock` entry. If omitted, Changesets derives it from the package name.
- `versionFile`: path to a Ruby version file, relative to the package directory. If omitted, Changesets checks `lib/<gem-name>/version.rb`, `lib/<gem-name-with-underscores>/version.rb`, or a single discovered `lib/**/version.rb`.
- `gemspec`: path to a `.gemspec` file, relative to the package directory. If omitted, Changesets checks `<gem-name>.gemspec`, `<gem-name-with-underscores>.gemspec`, or a single discovered root `.gemspec`.
- `gemfileLock`: path to `Gemfile.lock`, relative to the package directory. If omitted, Changesets updates `Gemfile.lock` when it exists.

Configured paths must exist. Auto-discovered files are optional; if multiple ambiguous `version.rb` or `.gemspec` files exist, Changesets leaves those files unchanged unless you configure the exact path.

When updating `Gemfile.lock`, prerelease versions are converted to Bundler's lockfile format. For example, `2.0.0-beta.1` is written as `2.0.0.pre.beta.1`.

## `changedFilePatterns` (array of strings)

Glob patterns for changed files that should mark a package as changed. Useful to fine-tune what counts as a change (e.g. only source files, ignoring test files, etc).

Default value:

```json
{
  "changedFilePatterns": ["**"]
}
```

Example:

```json
{
  "changedFilePatterns": ["src/**", "lib/**"]
}
```

### `format` (optional string or boolean)

Default value: `"auto"`

The formatter to use to format changesets and changelogs. Set `false` to disable formatting. The default value of `"auto"` will auto-detect the formatter based on the project's configuration files. See the [`@changesets/format` documentation](https://github.com/changesets/format) for more details.

Supported formatters include `"prettier"`, `"oxfmt"`, `"deno"`, and `"dprint"`.
