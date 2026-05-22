# Customize Commit Format

If the [`commit`](./config.md#commit) option is enabled, Changesets will automatically commit changes made during the [`add`](./cli.md#add) and [`version`](./cli.md#version) commands.

The default commit message generator (`@changesets/cli/commit`) uses the following format:

- For `add` command:

  ```
  docs(changeset): {summary}
  ```

- For `version` command:

  ```
  RELEASING: Releasing {numPackagesReleased} package(s)

  Releases:
  {releasesLines}
  ```

These can be customized with a custom commit generator.

::: info
Many of the APIs below may look similar to a [custom changelog generator](./customize-changelog-format.md).
:::

## Writing a Custom Commit Generator

The commit message formatting can be customized with two optional functions: `getAddMessage` and `getVersionMessage`. If one function is not provided, the default generator will be used for that command.

The functions must be default exported as an object containing them. For example:

::: code-group

```ts [TypeScript]
// Install `@changesets/types` to get the `CommitFunctions` type
import type { CommitFunctions } from "@changesets/types";

const functions: CommitFunctions = {
  getAddMessage() {},
  getVersionMessage() {},
};

export default functions;
```

```js [JavaScript]
const functions = {
  getAddMessage() {},
  getVersionMessage() {},
};

export default functions;
```

:::

These functions are run when committing changes during the `add` and `version` commands and are expected to return a string (or a promise with a string).

```ts
type Changeset = {
  // The Markdown summary of the changeset
  summary: string;
  // The package names to be released and their respective semver bump types
  releases: Array<{ name: string; type: VersionType }>;
};

type GetAddMessage = (
  // The changeset for this release
  changeset: Changeset,
  // Options passed to the second item of the tuple
  commitOpts?: Record<string, any>,
) => string | Promise<string>;

type GetVersionMessage = (
  // The releases information for this version commit
  releasePlan: ReleasePlan,
  // Options passed to the second item of the tuple
  commitOpts?: Record<string, any>,
) => string | Promise<string>;

type CommitFunctions = {
  getAddMessage?: GetAddMessage;
  getVersionMessage?: GetVersionMessage;
};
```

## Using a Custom Commit Generator

To use a custom commit generator, you can specify the path to the file (relative to the config file) or the module if it's packaged as a dependency, using the [`commit`](./config.md#commit) option:

```json [.changeset/config.json]
{
  "commit": "./commit-generator.ts"
}
```

```json [.changeset/config.json]
{
  "commit": "commit-generator-pkg"
}
```

You can also specify options to be passed to the commit functions' `commitOpts` parameter:

```json [.changeset/config.json]
{
  "commit": ["./commit-generator.ts", { "showCommit": false }]
}
```
