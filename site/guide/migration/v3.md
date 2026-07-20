# Migrating to v3

<!-- not breaking: afraid-radios-fetch, brown-jokes-clap, changelog-github-template, eight-ears-study, every-boats-crash -->
<!-- todo: bright-points-think -->

## All Packages & CLI

### Updated Node.js and Package Manager Version Requirements

<!-- free-results-love, free-results-love-2, deep-coins-attend, lucky-terms-sink -->

Changesets v3 requires [Node.js](https://nodejs.org) `^22.11 || ^24 || >=26` and supports these package managers:

- [pnpm](https://pnpm.io) `>=10.0.0`
- [npm](https://www.npmjs.com) `>=10.9.0`
- [yarn](https://yarnpkg.com) `>=4.5.2`

Lower versions may still work but are not guaranteed nor tested.

### Dropped support for Bolt monorepos

<!-- plain-planes-arrive -->

We recommend migrating to [`pnpm`](https://pnpm.io/workspaces) or [`npm`](https://docs.npmjs.com/cli/v12/using-npm/workspaces) workspaces.

### Removed all backwards support for Changesets v1

<!-- cool-places-hug, chatty-kings-bake, green-pianos-sneeze, lovely-years-spend, orange-cups-ask -->

If you are still using configuration, packages, or the CLI from v1, upgrade to v2 and then v3.

### Changed the default base branch to `main`

<!-- plenty-forks-sip -->

If your repo uses `master` you now have to specify it:

```diff
{
  "$schema": "https://...",
+ "baseBranch": "master"
}
```

If your repo uses `main` you can now remove the config field:

```diff
{
  "$schema": "https://...",
- "baseBranch": "main"
}
```

## The CLI

### `prettier` option is replaced with `format`

<!-- clean-cameras-fix, green-forks-carry -->

Changesets now supports more formatters than of just Prettier. It will auto-detect if one is installed already and use it.

As such the `prettier` config option has been removed in favor of [`format`](/guide/config#format):

```diff
{
  "$schema": "https://...",
- "prettier": true
}
```

If you want Changesets to use a specific (supported) formatter you can configure it via [`format`](/guide/config#format):

```diff
{
  "$schema": "https://...",
+ "format": "dprint"
}
```

TODO: Should we support arbitrary commands via `format`?

You can also disable formatting with `false`.

### Removed `private` alias in [`access`](/guide/config#access) configuration

<!-- light-friends-warn -->

Replace `private` with `restricted` in your Changesets config:

```diff
{
  "$schema": "https://...",
  "baseBranch": "main",
- "access": "private"
+ "access": "restricted"
}
```

### `tag` command has been renamed `git-tag`

<!-- clean-tags-rename -->

TODO: how should we handle deprecations?

`changsets tag` has been renamed to `changesets git-tag` to more accurately reflect its job (creating git tags, not npm's dist-tags).

### Better alignment with package managers

<!-- fair-lamps-relate -->

- Changesets now matches `pnpm`'s behavior more closely in projects using it.
  - Both scope-based `publishConfig` registry overrides and `publishConfig.registry` are now ignored.

## Changelog Formatters

...

## The Rest

These only matter to you if you use the package in question directly (not via the CLI).

### `@changesets/logger`

<!-- curly-kids-thank -->

The package has been deprecated and will no longer receive any updates.

TODO: deprecate package in npm after releasing v3

### `@changesets/config`

#### Reworked package

<!-- cool-camels-type -->

Config parsing has been made more robust and maintainable. As part of this the exported functionality has been reworked from the ground up.

Removed `read` and `parse` functions in favor of `readConfig`, which returns `{ config, warnings, errors }` instead of throwing on issues.

```ts
// before.ts
import { parse } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";

const config = parse({ commit: true }, await getPackages());

try {
  return parse({ commit: true }, packages);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Invalid config: ${err.message}`);
  } else {
    throw err;
  }
}

// after.ts
import { readConfig } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";

// both arguments are optional
const { config, warnings, errors } = readConfig(
  process.cwd(),
  await getPackages(),
);

if (warnings.length !== 0) {
  console.warn(warnings.join("\n"));
}
if (config == null) {
  console.error(errors.join("\n"));
}
```

### `@changesets/get-github-info`

<!-- fiery-animals-knock -->

Renamed `getInfo` to `getCommitInfo`, and `getInfoFromPullRequest` to `getPullRequestInfo`.

The return types have also been changed slightly to increase clarity.

```diff
const info = await getCommitInfo({ commit, repo });
if (info == null) return;

-const authorLogin = info.user;
+const authorLogin = info.author.login;

-const authorLink = info.links.author;
+const authorLink = info.author.markdownLink;

-const pullNumber = info.pull;
+const pullNumber = info.pull.number;

-const pullLink = info.links.pull;
+const pullLink = info.pull.markdownLink;

-const commitLink = info.links.commit;
+const commitLink = info.commit.markdownLink;
```

`getPullRequestInfo` has a similar migration path.

### `@changesets/types`

<!-- cozy-knives-brake -->

- The `CommitFunctions` and `ChangelogFunctions` types have been narrowed to
  `null | Record<string, unknown>` instead of `any` or `Record<string, any>`

### `@changesets/release-utils`

#### Changed `runPublish()` signature

<!-- clever-frogs-kick -->

Now requires passing separate `command` and `args` parameters:

```diff
runPublish({
-  script: `node -e 'console.log("test")'`
+  command: "node",
+  args: ["-e", `console.log("test")`]
  cwd: import.meta.dirname,
})
```
