# Migrating from v2 to v3

This guide covers the changes you may need to make when upgrading a project from Changesets v2 to v3.

If you only use `@changesets/cli`, focus on the requirements, configuration, CLI, prerelease, and release-behavior sections. If you import other `@changesets/*` packages directly, also read [Package API changes](#package-api-changes).

<!-- no migration action: afraid-radios-fetch, bright-points-think, brown-jokes-clap, changelog-github-template, curly-kids-thank, eight-ears-study -->

## Migration checklist

1. Upgrade Node.js and your package manager to a supported version.
2. If you import `@changesets/*` packages directly, make sure your code can load ES modules.
3. Review `.changeset/config.json` for renamed options and changed defaults.
4. Update renamed CLI commands and any CI logic that depends on exit codes.
5. Review the prerelease and dependency-bumping behavior changes.
6. Upgrade `@changesets/cli` and any directly installed `@changesets/*` packages together.
7. Follow the [verification steps](#verify-the-migration) before publishing.

## Requirements and module format

### Upgrade Node.js and your package manager

<!-- deep-coins-attend, every-boats-crash, free-results-love, free-results-love-2, lucky-terms-sink -->

Changesets v3 requires [Node.js](https://nodejs.org) `^22.11 || ^24 || >=26` and supports:

- [pnpm](https://pnpm.io) `>=10.0.0`
- [npm](https://www.npmjs.com) `>=10.9.0`
- [Yarn](https://yarnpkg.com) `>=4.5.2`

Upgrade these tools before installing Changesets v3. Older versions may still work, but they are not tested or supported. Yarn Classic is no longer supported.

### Changesets packages are now ES modules

<!-- spotty-chairs-call -->

All Changesets packages are now published as ES modules. Using the CLI from package scripts does not require a code change, but code that imports Changesets packages must use ESM-compatible imports.

```diff
-const { readChangesets } = require("@changesets/read");
+import { readChangesets } from "@changesets/read";
```

If your project still uses CommonJS, use dynamic `import()` or migrate the consuming module to ESM.

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

### `initialVersions` was removed from `pre.json`

<!-- ready-rockets-boil -->

The unused `initialVersions` property has been removed. Normal Changesets workflows require no action, but custom tooling that reads `.changeset/pre.json` must stop relying on this property.

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

## Package API changes

You can skip this section if your project only invokes `@changesets/cli` and does not import other Changesets packages.

### `@changesets/config`: use `readConfig` or `validateConfig`

<!-- cool-camels-type -->

The `read` and `parse` exports were removed. Use `readConfig` to read `.changeset/config.json` from a project:

```diff
-import { read } from "@changesets/config";
+import { readConfig } from "@changesets/config";

-const config = await read(process.cwd());
+const { config, warnings, errors } = await readConfig(process.cwd());
+
+for (const warning of warnings) {
+  console.warn(warning);
+}
+if (config === undefined) {
+  throw new Error(errors.join("\n"));
+}
```

Use `validateConfig(json, packages)` when you already have an in-memory configuration object. Both functions return `{ config, warnings, errors }`; invalid configuration is reported in `errors` instead of being thrown.

### `@changesets/errors`: `ValidationError` was removed

<!-- wicked-dryers-shave -->

Configuration validation no longer throws `ValidationError`. Handle the `errors` returned by `readConfig` or `validateConfig` as shown above.

### `@changesets/get-github-info`: renamed functions and result fields

<!-- fiery-animals-knock -->

`getInfo` was renamed to `getCommitInfo`, and `getInfoFromPullRequest` was renamed to `getPullRequestInfo`. Both functions may return `undefined` when the requested repository item cannot be found.

```diff
-import { getInfo } from "@changesets/get-github-info";
+import { getCommitInfo } from "@changesets/get-github-info";

-const info = await getInfo({ commit, repo });
-const authorLogin = info.user;
-const authorLink = info.links.author;
-const pullNumber = info.pull;
-const pullLink = info.links.pull;
-const commitLink = info.links.commit;
+const info = await getCommitInfo({ commit, repo });
+if (info === undefined) return;
+
+const authorLogin = info.author?.login;
+const authorLink = info.author?.markdownLink;
+const pullNumber = info.pull?.number;
+const pullLink = info.pull?.markdownLink;
+const commitLink = info.commit.markdownLink;
```

`getPullRequestInfo` returns the same nested `author`, `pull`, and `commit` shapes where applicable.

### `@changesets/release-utils`: pass commands and arguments separately

<!-- clever-frogs-kick -->

The publish helper now takes a command and argument array instead of a shell-script string:

```diff
await publish({
- script: "pnpm changeset publish",
+ command: "pnpm",
+ args: ["changeset", "publish"],
  cwd: process.cwd(),
});
```

### `@changesets/release-utils`: removed process helpers

<!-- chatty-kings-bake -->

`execWithOutput` and `spawnWithOutput` were removed. They were not intended to be public APIs. Replace direct usage with [`tinyexec`](https://github.com/tinylibs/tinyexec) or `node:child_process`.

### Formatter functions may be synchronous

<!-- some-papayas-bet, some-papayas-gamble -->

`ChangelogFunctions` and `CommitFunctions` may now return either a value or a promise. The default changelog and commit functions now return values synchronously.

Code that uses `await` works with both versions and requires no change. Code that calls `.then()` directly on a default formatter result must switch to `await` or wrap the result in `Promise.resolve()`.

### Formatter option types are stricter

<!-- cozy-knives-brake -->

The option parameters for `CommitFunctions` and `ChangelogFunctions`, together with the `commit` and `changelog` fields in `Config` and `WrittenConfig`, now use `null | Record<string, unknown>` instead of `any`-based types.

This may reveal TypeScript errors in custom formatters. Give the options an explicit type and narrow unknown values before using them.

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
