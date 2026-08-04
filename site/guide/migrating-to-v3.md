# Migrating from v2 to v3

Most projects interact with Changesets through `@changesets/cli`, so this guide focuses on the changes affecting this most common level of usage.

The lower-level `@changesets/*` packages have their own breaking API changes. Using them directly is an advanced use case; if that applies to your project, read the package's `CHANGELOG.md` in the [packages directory](https://github.com/changesets/changesets/tree/main/packages) before upgrading it.

<!-- no CLI migration action: afraid-radios-fetch, bright-points-think, brown-jokes-clap, changelog-github-template, chatty-kings-bake, clever-frogs-kick, cool-camels-type, cozy-knives-brake, curly-kids-thank, eight-ears-study, fiery-animals-knock, ready-rockets-boil, some-papayas-bet, some-papayas-gamble, wicked-dryers-shave -->

## Migration checklist

1. **Upgrade the CLI.** Upgrade `@changesets/cli` to v3.
2. **Check tool compatibility.** Make sure you're using supported versions of Node.js and your package manager.
3. **Using the GitHub Action?** Upgrade it to v2 as well. Choose a v2 release from the action's [release notes](https://github.com/changesets/action/releases), then pin your workflow to that release's full commit SHA rather than the floating `@v2` tag.
4. **Check your configuration.** Look through `.changeset/config.json` for renamed options and defaults that have changed.
5. **Update scripts and CI.** Replace renamed commands and review any logic that depends on CLI exit codes.
6. **Review release behavior.** Pay close attention to prereleases, private packages, and peer dependencies adjustments.

## Requirements and module format

### Upgrade Node.js and your package manager

<!-- deep-coins-attend, every-boats-crash, free-results-love, free-results-love-2, lucky-terms-sink -->

Changesets v3 requires [Node.js](https://nodejs.org) `^22.11 || ^24 || >=26` and supports:

- [pnpm](https://pnpm.io) `>=10.0.0`
- [npm](https://www.npmjs.com) `>=10.9.0`
- [Yarn](https://yarnpkg.com) `>=4.5.2`

Upgrade these tools before installing Changesets v3. Older versions may still work, but they are not tested or supported. Yarn Classic is no longer supported.

### The CLI package is now an ES module

<!-- spotty-chairs-call -->

`@changesets/cli` and the other Changesets packages are now published as ES modules. Invoking `changeset` from package scripts or CI continues to work normally on a supported Node.js version.

Only custom JavaScript that imports Changesets packages directly needs ESM migration work. Follow the release notes for the package being imported in that case.

### Bolt workspaces are no longer detected

<!-- plain-planes-arrive -->

Changesets no longer supports Bolt monorepos. Migrate the workspace to [pnpm](https://pnpm.io/workspaces), [npm](https://docs.npmjs.com/cli/v12/using-npm/workspaces), or Yarn workspaces before upgrading.

### Upgrade v1 projects to v2 first

<!-- busy-points-guess, cool-places-hug, green-pianos-sneeze, lovely-years-spend, orange-cups-ask -->

Changesets v3 removes the remaining compatibility code for v1 changeset files, configuration, and the old `changeset bump` workflow. If your project still uses v1 behavior, upgrade it to the latest v2 release before moving to v3.

## Configuration changes

Only apply the changes below when the affected option is present in your `.changeset/config.json` or when you need to preserve the v2 default behavior.

### Move `useCalculatedVersionForSnapshots` to `snapshot`

<!-- tangy-buses-smoke -->

The experimental snapshot option has been removed. Move it to the stable `snapshot` configuration:

```diff
{
- "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
-   "useCalculatedVersionForSnapshots": true
- }
+ "snapshot": {
+   "useCalculatedVersion": true
+ }
}
```

See [`snapshot.useCalculatedVersion`](./config.md#snapshot-usecalculatedversion) for details.

### Set `baseBranch` when your default branch is not `main`

<!-- plenty-forks-sip -->

The default value of `baseBranch` changed from `master` to `main`.

If your repository still uses `master`, make the value explicit:

```diff
{
+ "baseBranch": "master"
}
```

If your repository uses `main`, you can keep an explicit value or remove it:

```diff
{
- "baseBranch": "main"
}
```

### Opt in to versioning private packages

<!-- tidy-pandas-wave -->

Private packages are no longer versioned by default. To preserve the v2 behavior of versioning them without creating Git tags, add:

```diff
{
+ "privatePackages": { "version": true, "tag": false }
}
```

Set `privatePackages` to `true` if you want Changesets to both version and tag private packages. See [`privatePackages`](./config.md#privatepackages) for all options.

### Replace `prettier` with `format`

<!-- clean-cameras-fix, green-forks-carry, wise-mirrors-fry -->

The `prettier` option has been replaced by [`format`](./config.md#format). Changesets can now format generated changesets, changelogs, and rewritten `package.json` files with Prettier, Oxfmt, Deno, or dprint.

If you previously disabled formatting, rename the option:

```diff
{
- "prettier": false
+ "format": false
}
```

If you previously enabled Prettier, either use `"format": "prettier"` or remove the option to use automatic formatter detection. The default is `"auto"`.

### Replace `access: "private"` with `"restricted"`

<!-- light-friends-warn -->

The `private` alias is no longer accepted by the TypeScript configuration types. Use the npm access value `restricted`:

```diff
{
- "access": "private"
+ "access": "restricted"
}
```

## CLI and CI changes

### Rename `tag` to `git-tag`

<!-- clean-tags-rename -->

The `tag` command was renamed to make it clear that it creates Git tags rather than npm dist-tags:

```diff
-$ changeset tag
+$ changeset git-tag
```

Update package scripts and CI workflows that call the old command.

### Replace `--sinceMaster`

<!-- rare-carrots-read -->

The deprecated `changeset status --sinceMaster` flag has been removed. Pass the branch explicitly:

```diff
-$ changeset status --sinceMaster
+$ changeset status --since=main
```

Use `--since=master` instead if that is your repository's base branch.

### Handle `version` returning exit code 1 when there is nothing to release

<!-- fix-version-no-changesets-exit-code -->

`changeset version` now exits with code `1` when there are no unreleased changesets. Previously, this case exited successfully without changing anything.

Review automation that treats every non-zero exit as an unexpected failure. In particular, make sure snapshot and release workflows distinguish “nothing to version” from an actual versioning error when that distinction matters.

### Expect small changes to interactive prompts

<!-- wet-loops-watch -->

The CLI now uses a different prompt library. The workflow is unchanged, but prompts look slightly different and cancellation is handled more reliably. No migration action is required unless tests or automation depend on the exact terminal output.

## Prerelease changes

### Versioned changesets move to `.changeset/pre/`

<!-- loud-parents-crash -->

During prerelease mode, changesets that have already been included in a prerelease are now moved from `.changeset/` to `.changeset/pre/`. Their IDs are no longer accumulated in `.changeset/pre.json`.

Existing prerelease state is migrated automatically the next time you run `changeset version` or `changeset status`. Commit the resulting file moves.

You may edit or delete files in `.changeset/pre/` before the stable release if their changelog entries are no longer relevant. You do not need to update `.changeset/pre.json` after doing so.

See [Manage Prerelease Changesets](./prereleases.md#manage-prerelease-changesets) for the complete workflow.

### Prerelease tags are more consistent on non-npm registries

<!-- many-regions-cough -->

When a package has only prerelease versions, Changesets now uses the configured prerelease tag on registries that do not automatically assign `latest`.

The npm registry does assign `latest` automatically, so publishing a new package there continues to use `latest` rather than the configured prerelease tag. If you publish to another registry, verify its resulting dist-tags once after upgrading.

## Release behavior to review

### Peer dependency updates bump dependents by `patch`

<!-- wide-feet-lie -->

When a peer dependency is updated, Changesets now bumps dependent packages by `patch` instead of assuming the update is breaking and bumping them by `major`.

If a dependent package is incompatible with the peer dependency's new version, add a `major` changeset for that package explicitly.

### pnpm registry detection follows pnpm more closely

<!-- fair-lamps-relate -->

For pnpm projects, unpublished-package checks now follow pnpm's registry behavior. Scope-based `publishConfig` registry overrides and `publishConfig.registry` are ignored during these checks.

If your repository relied on those fields to select a registry during unpublished-package detection, verify the result against your pnpm and npm configuration after upgrading.

## Verify the migration

Before publishing with v3:

1. Install dependencies and run your normal build, type-check, lint, and test commands.
2. Run `changeset status` and confirm the expected release plan is produced.
3. If the project is in prerelease mode, review and commit any files moved into `.changeset/pre/`.
4. On a disposable branch, run `changeset version` with representative changesets and inspect the version, changelog, dependency, and formatting changes.
5. Confirm private packages are versioned or skipped as intended.
6. Test release automation both with pending changesets and with nothing to version.
7. If you publish to a non-npm registry, verify the registry and dist-tags selected for a prerelease.

For more detail, see the [configuration reference](./config.md), [CLI reference](./cli.md), [prerelease guide](./prereleases.md), and [versioning and publishing guide](./versioning-and-publishing.md).
