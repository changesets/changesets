# Modifying Changelog Format

Changesets comes with a default formatter for the changelogs at `@changesets/cli/changelog`. It displays relatively basic information, however, this can be customized with the [`changelog`](./config.md#changelog) option.

## Writing a Custom Changelog Formatter

The changelog formatting can be customized with two functions: `getReleaseLine` and `getDependencyReleaseLine`. These must be default exported as an object containing the functions. For example:

::: code-group

```ts [TypeScript]
// Install `@changesets/types` to get the `ChangelogFunctions` type
import type { ChangelogFunctions } from "@changesets/types";

const functions: ChangelogFunctions = {
  getReleaseLine() {}
  getDependencyReleaseLine(){}
};

export default functions;
```

```js [JavaScript]
const functions = {
  getReleaseLine() {},
  getDependencyReleaseLine() {},
};

export default functions;
```

:::

These functions are run during the [`version`](./cli.md#version) command and are expected to return a string (or a promise with a string).

```ts
type VersionType = "major" | "minor" | "patch";

type NewChangesetWithCommit = {
  // The file name of the changeset, e.g. "cool-places-hug"
  id: string;
  // The Markdown summary of the changeset
  summary: string;
  // The package names to be released and their respective semver bump types
  releases: Array<{ name: string; type: VersionType }>;
  // The commit hash that introduced the changeset
  commit?: string;
};

type GetReleaseLine = (
  // The changeset for this release
  changeset: NewChangesetWithCommit,
  // The type of change for this release: "major", "minor", or "patch"
  type: VersionType,
  // Options passed to the second item of the tuple
  changelogOpts?: Record<string, any>,
) => MaybePromise<string>;

type GetDependencyReleaseLine = (
  // The changesets that causes a dependency update
  changesets: NewChangesetWithCommit[],
  // The dependencies that are being updated
  dependenciesUpdated: ModCompWithPackage[],
  // Options passed to the second item of the tuple
  changelogOpts?: Record<string, any>,
) => MaybePromise<string>;

type ChangelogFunctions = {
  getReleaseLine: GetReleaseLine;
  getDependencyReleaseLine: GetDependencyReleaseLine;
};
```

## Using a Custom Changelog Formatter

To use a custom changelog formatter, you can specify the path to the file (relative to the config file) or the module if it's packaged as a dependency in the [`changelog`](./config.md#changelog) option:

```json [.changeset/config.json]
{
  "changelog": "./changelog-formatter.ts"
}
```

```json [.changeset/config.json]
{
  "changelog": "changelog-formatter-pkg"
}
```

You can also specify options to be passed to the changelog functions' `changelogOpts` option:

```json [.changeset/config.json]
{
  "changelog": ["./changelog-formatter.ts", { "showCommit": false }]
}
```
