# Migrating from v2 to v3

Most projects interact with Changesets through `@changesets/cli`, so this guide focuses on the changes affecting this most common level of usage.

The lower-level `@changesets/*` packages have their own breaking API changes. Using them directly is an advanced use case. If that applies to your project, read the package's `CHANGELOG.md` in the [packages directory](https://github.com/changesets/changesets/tree/main/packages) before upgrading it.

## How to Migrate

Firstly, follow the [Install Requirements](#install-requirements) section below to prepare your environment for Changesets v3. Then, upgrade the Changesets CLI:

::: code-group

```bash [pnpm]
$ pnpm update @changesets/cli@3
```

```bash [npm]
$ npm update @changesets/cli@3
```

```bash [yarn]
$ yarn up @changesets/cli@3
```

:::

The following `@changesets/*` packages should also be updated accordingly if used directly:

| Package                              | Previous | Latest       |
| ------------------------------------ | -------- | ------------ |
| `@changesets/apply-release-plan`     | v7       | v8           |
| `@changesets/assemble-release-plan`  | v6       | v7           |
| `@changesets/changelog-git`          | v0.2     | v1           |
| `@changesets/changelog-github`       | v0.7     | v1           |
| `@changesets/config`                 | v3       | v4           |
| `@changesets/errors`                 | v0.2     | v1           |
| `@changesets/get-dependents-graph`   | v2       | v3           |
| `@changesets/get-github-info`        | v0.7     | v1           |
| `@changesets/get-release-plan`       | v4       | v5           |
| `@changesets/get-version-range-type` | v0.4     | v1           |
| `@changesets/git`                    | v3       | v4           |
| `@changesets/logger`                 | v0.1     | _deprecated_ |
| `@changesets/parse`                  | v0.4     | v1           |
| `@changesets/pre`                    | v2       | v3           |
| `@changesets/read`                   | v0.6     | v1           |
| `@changesets/release-utils`          | v0.2     | v1           |
| `@changesets/should-skip-package`    | v0.1     | v1           |
| `@changesets/types`                  | v6       | v7           |
| `@changesets/write`                  | v0.4     | v1           |

Once updated, follow the remaining sections below and review the changes that apply to your project.

## Install Requirements

### Check Node.js and package manager compatibility

Changesets v3 is compatible with [Node.js](https://nodejs.org) `^22.11 || ^24 || >=26` and the following package manager versions:

- [pnpm](https://pnpm.io) `>=10.0.0`
- [npm](https://www.npmjs.com) `>=10.9.0`
- [Yarn](https://yarnpkg.com) `>=4.5.2`

Before installing Changesets v3, check that your local development and CI environments use supported versions. Older versions might happen to work, but we don't test or support them. Yarn Classic is also no longer supported.

### All packages are now ES modules

`@changesets/cli` and the other Changesets packages are now published as ES modules. If you only run `changeset` from package scripts or CI, nothing else needs to change once you're using a supported Node.js version.

### Bolt workspaces are no longer detected

If your monorepo uses [Bolt](https://github.com/boltpkg/bolt), which is no longer maintained, migrate to [pnpm](https://pnpm.io/workspaces), [npm](https://docs.npmjs.com/cli/v12/using-npm/workspaces), or [yarn](https://yarnpkg.com/features/workspaces) workspaces before upgrading.

### Still using v1?

Changesets v3 no longer keeps v1 compatibility, such as v1 changeset files, configuration, or the `changeset bump` command. Upgrade to the latest v2 release first, address any v1 warnings, and then follow this guide to upgrade to v3.

## Configuration Changes

Open `.changeset/config.json` and work through the sections that match your setup. Most projects will only need one or two of these changes.

### Move experimental `useCalculatedVersionForSnapshots` to `snapshot.useCalculatedVersion`

This feature has been stabilized and renamed to [`snapshot.useCalculatedVersion`](./config.md#snapshot-usecalculatedversion).

<!-- prettier-ignore -->
```json [.changeset/config.json]
{
 "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": { // [!code --]
   "useCalculatedVersionForSnapshots": true // [!code --]
 }, // [!code --]
 "snapshot": { // [!code ++]
   "useCalculatedVersion": true // [!code ++]
 } // [!code ++]
}
```

### Set `baseBranch` if your default branch is not `main`

`main` is now the default value of `baseBranch`.

If your repository uses `master`, add it explicitly:

```json [.changeset/config.json]
{
  "baseBranch": "master" // [!code ++]
}
```

If it uses `main`, an existing explicit value is harmless, but you can remove it:

```json [.changeset/config.json]
{
  "baseBranch": "main" // [!code --]
}
```

### Opt in to versioning private packages

In Changesets v2, private packages were versioned without creating Git tags by default.

Changesets v3 now disables both behaviors by default as most projects don't version private packages, such as test fixtures. If you had worked around this by using the [`ignore`](./config.md#ignore) option before (such as ignoring test fixtures), you should remove them from the `ignore` option:

```json [.changeset/config.json]
{
  "ignore": ["@test/**"] // [!code --]
}
```

If you'd like to preserve the old behavior and version private packages, set the [`privatePackages.version`](./config.md#privatepackages-version) option to `true`:

```json [.changeset/config.json]
{
  "privatePackages": { "version": true, "tag": false } // [!code ++]
}
```

### Replace `prettier` with `format`

Formatting is now configured with [`format`](./config.md#format) rather than `prettier`. The new option supports Prettier, Oxfmt, Deno, and dprint to format the generated changesets and changelogs.

On a similar note, when Changesets updates a `package.json`, it'll now edit the specific fields directly without reformatting the entire file.

If you're using one of the supported formatters, you can remove this option and let the default `"auto"` mode detect the formatter used by your project.

```json [.changeset/config.json]
{
  "prettier": false // [!code --]
}
```

If you'd like to continue disable formatting, set `"format": false` instead:

```json [.changeset/config.json]
{
  "prettier": false, // [!code --]
  "format": false // [!code ++]
}
```

### Replace `access: "private"` with `"restricted"`

The `"private"` alias is no longer accepted by the configuration types. Replace it with npm's `"restricted"` access value:

```json [.changeset/config.json]
{
  "access": "private", // [!code --]
  "access": "restricted" // [!code ++]
}
```

## CLI and CI Changes

### Rename `tag` command to `git-tag`

The `tag` command is now called `git-tag`, making it clearer that the command creates Git tags rather than npm dist-tags:

```bash
$ changeset tag # [!code --]
$ changeset git-tag # [!code ++]
```

Remember to update any package scripts or CI workflows that call the old command.

### Rename `--sinceMaster` flag to `--since`

The deprecated `--sinceMaster` flag has been removed. Pass the branch name to `--since` instead:

```bash
$ changeset status --sinceMaster # [!code --]
$ changeset status --since=main # [!code ++]
```

Use `--since=master` if that is your repository's base branch.

### Handle `version` command returning exit code 1 when there is nothing to release

`changeset version` now exits with code `1` when there are no unreleased changesets. In v2, it exited successfully without changing anything.

If an empty release is acceptable in your workflow, update the containing script so it doesn't treat this case as an unexpected failure. This is especially important for snapshot and automated release jobs.

### Expect small changes to interactive prompts

The interactive workflow hasn't changed, but the prompts look a little different and cancellation is more reliable. You only need to do something here if tests or automation depend on the exact terminal output.

Alternatively, use the `--major`, `--minor`, `--patch`, and `--message` flags for `changeset add` to create a changeset directly and non-interactively.

## Prerelease Changes

Run the `changeset status` command and it'll handle the migration of the prerelease state automatically. These changes should be committed. Below are the details of what changed.

### Versioned changesets are moved to `.changeset/pre/`

In prerelease mode, changesets that have already gone into a prerelease now move from `.changeset/` to `.changeset/pre/`. Their IDs are no longer collected in `.changeset/pre.json`.

The files in `.changeset/pre/` provide the changelog entries for the eventual stable release. You can edit or delete entries that are no longer relevant without updating `.changeset/pre.json` by hand.

See [Manage Prerelease Changesets](./prereleases.md#manage-prerelease-changesets) for the complete workflow.

### Prerelease tags are more consistent on non-npm registries

This change mainly matters if you publish somewhere other than npm. When a package has only prerelease versions, Changesets now uses the configured prerelease tag on registries that don't assign `latest` automatically.

npm does assign `latest` automatically, so a new package published there continues to use `latest` rather than the configured prerelease tag.

## Release Behavior Changes

### Peer dependency updates bump dependents by `patch`

Updating a peer dependency now gives dependent packages a `patch` bump instead of assuming the update is breaking and giving them a `major` bump.

Review these dependents when you add the changeset. If one really is incompatible with the new peer dependency, add an explicit `major` changeset for it.

### pnpm registry detection follows pnpm more closely

This only affects pnpm projects. When Changesets checks whether a package is unpublished, it now follows pnpm's registry behavior and ignores scope-based `publishConfig` registry overrides and `publishConfig.registry`.

If you relied on either field for this check, migrate the config to an [`.npmrc` file](https://docs.npmjs.com/cli/configuring-npm/npmrc) instead.

## GitHub Actions Changes

### Update to `changesets/action@v2`

Update to `changesets/action@v2` in your GitHub Actions workflows to support Changesets v3. The v1 action will only work with Changesets v2.

<!-- prettier-ignore -->
```yaml [.github/workflows/publish.yml]
# ...
        uses: changesets/action@v1 # [!code --]
        uses: changesets/action@v2 # [!code ++]
# ...
```

### Review your workflow setup

While the existing action should work as before, the v2 action exposes more sub-actions that allow you to better customize, compose, and secure your GitHub Actions workflows.

For instance, if you are using [npm trusted publishing (provenance)](https://docs.npmjs.com/trusted-publishers), it is recommended to migrate to these sub-actions to tighten publish permissions. Check the new [Automating Changesets guide](./automating.md) for the new setup recommendations.

### Update inputs

If you passed any inputs, make sure to update them accordingly:

<!-- prettier-ignore -->
```yaml [.github/workflows/publish.yml]
# ...
        uses: changesets/action@v1 # [!code --]
        with: # [!code --]
          version: pnpm run version # [!code --]
          publish: pnpm run publish # [!code --]
          commit: "ci: release" # [!code --]
          title: "ci: release" # [!code --]
        uses: changesets/action@v2 # [!code ++]
        with: # [!code ++]
          version-script: pnpm run version # [!code ++]
          publish-script: pnpm run publish # [!code ++]
          commit-message: "ci: release" # [!code ++]
          pr-title: "ci: release" # [!code ++]
# ...
```

In case you had set a `GITHUB_TOKEN` environment variable, pass it via the `github-token` parameter now.
If you rely on the local Git state for subsequent steps, make sure to set `push-with-git-cli: true` as well.

For the full list of breaking changes, check out the [v2.0.0 release notes](https://github.com/changesets/action/releases/tag/v2.0.0) in the [action repository](https://github.com/changesets/action).

## You're all set!

That covers all the major updates. Good luck with your migration to v3, and happy releasing!
