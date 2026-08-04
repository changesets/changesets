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

### Check Node.js and package manager compatibility

<!-- deep-coins-attend, every-boats-crash, free-results-love, free-results-love-2, lucky-terms-sink -->

Changesets v3 is compatible with [Node.js](https://nodejs.org) `^22.11 || ^24 || >=26` and the following package manager versions:

- [pnpm](https://pnpm.io) `>=10.0.0`
- [npm](https://www.npmjs.com) `>=10.9.0`
- [Yarn](https://yarnpkg.com) `>=4.5.2`

Before installing Changesets v3, check that your local development and CI environments use supported versions. If they already do, you don't need to change them. Older versions might happen to work, but we don't test or support them. Yarn Classic is no longer supported.

### The CLI package is now an ES module

<!-- spotty-chairs-call -->

`@changesets/cli` and the other Changesets packages are now published as ES modules. If you only run `changeset` from package scripts or CI, nothing else needs to change once you're using a supported Node.js version.

If custom JavaScript uses `require()` to load a Changesets package on Node.js 22.11, migrate it to ESM or use `--experimental-require-module`.

### Bolt workspaces are no longer detected

<!-- plain-planes-arrive -->

If your monorepo uses [Bolt](https://github.com/boltpkg/bolt), which is no longer maintained, move it to [pnpm](https://pnpm.io/workspaces), [npm](https://docs.npmjs.com/cli/v12/using-npm/workspaces), or [Yarn workspaces](https://yarnpkg.com/features/workspaces) before upgrading.

### Still using v1?

<!-- busy-points-guess, cool-places-hug, green-pianos-sneeze, lovely-years-spend, orange-cups-ask -->

Upgrade to the latest v2 release first. v3 no longer supports v1 changeset files, configuration, or `changeset bump`.

## Configuration changes

Open `.changeset/config.json` and work through the sections that match your setup. Most projects will only need one or two of these changes.

### Move experimental `useCalculatedVersionForSnapshots` to `snapshot`

<!-- tangy-buses-smoke -->

The old experimental location for this option is gone. Move it to the stable `snapshot` configuration:

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

`main` is now the default value of `baseBranch`.

If your repository uses `master`, add it explicitly:

```diff
{
+ "baseBranch": "master"
}
```

If it uses `main`, an existing explicit value is harmless, but you can remove it:

```diff
{
- "baseBranch": "main"
}
```

### Opt in to versioning private packages

<!-- tidy-pandas-wave -->

In v2, private packages were versioned without creating Git tags. To keep that behavior, add:

```diff
{
+ "privatePackages": { "version": true, "tag": false }
}
```

Use `"privatePackages": true` instead if you want Changesets to both version and tag private packages. See [`privatePackages`](./config.md#privatepackages) for all options.

### Replace `prettier` with `format`

<!-- clean-cameras-fix, green-forks-carry, wise-mirrors-fry -->

Formatting is now configured with [`format`](./config.md#format) rather than `prettier`. The new option supports Prettier, Oxfmt, Deno, and dprint for generated changesets and changelogs. When Changesets updates a `package.json`, it preserves the file's existing formatting.

If you previously disabled formatting, rename the option:

```diff
{
- "prettier": false
+ "format": false
}
```

If you previously enabled Prettier, set `"format": "prettier"`. You can also remove the option and let the default `"auto"` mode detect the formatter used by your project.

### Replace `access: "private"` with `"restricted"`

<!-- light-friends-warn -->

The `private` alias is no longer accepted by the configuration types. Replace it with npm's `restricted` access value:

```diff
{
- "access": "private"
+ "access": "restricted"
}
```

## CLI and CI changes

### Rename `tag` to `git-tag`

<!-- clean-tags-rename -->

The `tag` command is now called `git-tag`, making it clearer that the command creates Git tags rather than npm dist-tags:

```diff
-$ changeset tag
+$ changeset git-tag
```

Remember to update any package scripts or CI workflows that call the old command.

### Replace `--sinceMaster`

<!-- rare-carrots-read -->

The deprecated `--sinceMaster` shortcut has been removed. Pass the branch name to `--since` instead:

```diff
-$ changeset status --sinceMaster
+$ changeset status --since=main
```

Use `--since=master` if that is your repository's base branch.

### Handle `version` returning exit code 1 when there is nothing to release

<!-- fix-version-no-changesets-exit-code -->

One CI behavior deserves extra attention: `changeset version` now exits with code `1` when there are no unreleased changesets. In v2, it exited successfully without changing anything.

If an empty release is acceptable in your workflow, update the containing script so it doesn't treat this case as an unexpected failure. This is especially important for snapshot and automated release jobs.

### Expect small changes to interactive prompts

<!-- wet-loops-watch -->

The interactive workflow hasn't changed, but the prompts look a little different and cancellation is more reliable. You only need to do something here if tests or automation depend on the exact terminal output.

## Prerelease changes

### Versioned changesets move to `.changeset/pre/`

<!-- loud-parents-crash -->

In prerelease mode, changesets that have already gone into a prerelease now move from `.changeset/` to `.changeset/pre/`. Their IDs are no longer collected in `.changeset/pre.json`.

The first time you run `changeset version` or `changeset status`, v3 migrates any existing prerelease state for you. This produces file moves that should be committed.

The files in `.changeset/pre/` provide the changelog entries for the eventual stable release. You can edit or delete entries that are no longer relevant without updating `.changeset/pre.json` by hand.

See [Manage Prerelease Changesets](./prereleases.md#manage-prerelease-changesets) for the complete workflow.

### Prerelease tags are more consistent on non-npm registries

<!-- many-regions-cough -->

This change mainly matters if you publish somewhere other than npm. When a package has only prerelease versions, Changesets now uses the configured prerelease tag on registries that don't assign `latest` automatically.

npm does assign `latest` automatically, so a new package published there continues to use `latest` rather than the configured prerelease tag.

## Release behavior to review

### Peer dependency updates bump dependents by `patch`

<!-- wide-feet-lie -->

Updating a peer dependency now gives dependent packages a `patch` bump instead of assuming the update is breaking and giving them a `major` bump.

Review these dependents when you add the changeset. If one really is incompatible with the new peer dependency, add an explicit `major` changeset for it.

### pnpm registry detection follows pnpm more closely

<!-- fair-lamps-relate -->

This only affects pnpm projects. When Changesets checks whether a package is unpublished, it now follows pnpm's registry behavior and ignores scope-based `publishConfig` registry overrides and `publishConfig.registry`.

If you relied on either field for this check, make sure v3 selects the registry you expect from your pnpm and npm configuration.

For more detail, see the [configuration reference](./config.md), [CLI reference](./cli.md), [prerelease guide](./prereleases.md), and [versioning and publishing guide](./versioning-and-publishing.md).
