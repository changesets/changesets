# Customize Changelog Format

Changesets uses a default changelog generator (`@changesets/cli/changelog`) that displays relatively basic information, however, this can be customized with the [`changelog`](./config.md#changelog) option.

::: info
Many of the APIs below may look similar to a [custom commit generator](./customize-commit-format.md).
:::

## Writing a Custom Changelog Generator

The changelog formatting can be customized with two functions: `getReleaseLine` and `getDependencyReleaseLine`. They must be default exported as an object containing the functions. For example:

::: code-group

```ts [TypeScript]
// Install `@changesets/types` to get the `ChangelogFunctions` type
import type { ChangelogFunctions } from "@changesets/types";

const functions: ChangelogFunctions = {
  getReleaseLine({ summary }) {
    return `- ${summary}`;
  },
  getDependencyReleaseLine(_changesets, dependenciesUpdated) {
    return dependenciesUpdated
      .filter(({ type }) => type !== "none")
      .map(({ name, newVersion }) => `- Updated ${name} to ${newVersion}`)
      .join("\n");
  },
};

export default functions;
```

```js [JavaScript]
const functions = {
  getReleaseLine({ summary }) {
    return `- ${summary}`;
  },
  getDependencyReleaseLine(_changesets, dependenciesUpdated) {
    return dependenciesUpdated
      .filter(({ type }) => type !== "none")
      .map(({ name, newVersion }) => `- Updated ${name} to ${newVersion}`)
      .join("\n");
  },
};

export default functions;
```

:::

These functions are run during the [`version`](./cli.md#version) command. Each function must return a string or a promise of a string. Return an empty string when there is nothing to add to the changelog.

- `getReleaseLine(changeset, type, changelogOpts)` receives one changeset and its release type.
- `getDependencyReleaseLine(changesets, dependenciesUpdated, changelogOpts)` receives the changesets that caused the dependency updates and the corresponding dependency releases.

A changeset has an `id`, `summary`, `releases`, and, when available, a `commit` hash. An `_` mapping in its YAML frontmatter is available as `changeset.metadata`. The values are typed as `unknown`, so check their types before using them.

For both functions, `changelogOpts` is the object from the second element of the [`changelog`](./config.md#changelog) tuple, or `null` if no options were supplied.

## Using a Custom Changelog Generator

To use a custom changelog generator, you can specify the path to the file (relative to the config file) or the module if it's packaged as a dependency, using the [`changelog`](./config.md#changelog) option:

```json [.changeset/config.json]
{
  "changelog": "./changelog-generator.ts"
}
```

```json [.changeset/config.json]
{
  "changelog": "changelog-generator-pkg"
}
```

You can also specify options to be passed to the changelog functions' `changelogOpts` parameter:

```json [.changeset/config.json]
{
  "changelog": ["./changelog-generator.ts", { "showCommit": false }]
}
```

You can also use our official [GitHub Changelog](/packages/changelog-github).
