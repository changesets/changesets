# Versioning and Publishing

Once you have accumulated some changesets, you can use the CLI to update the versions and changelogs of your packages, and publish them to npm.

This process is split into two steps: versioning and publishing.

## Versioning

Run the [`version`](./cli.md#version) command to update the package versions and changelogs:

::: code-group

```bash [npm]
$ npx @changesets/cli version
```

```bash [pnpm]
$ pnpm changeset version
```

```bash [yarn]
$ yarn changeset version
```

:::

Review the changes, ensure the versions and changelogs are updated as expected, and commit them to your repository.

## Publishing

Run the [`publish`](./cli.md#publish) command to publish the new versions of the packages:

::: code-group

```bash [npm]
$ npx @changesets/cli publish
```

```bash [pnpm]
$ pnpm changeset publish
```

```bash [yarn]
$ yarn changeset publish
```

:::

You can also create git tags for the published versions by passing the `--git-tag` flag. If you have published without git tags, you can still run the [`tag`](./cli.md#tag) command to create tags for the current published versions.

Make sure to push the tags to your git remote after creating them.

```bash
$ git push --follow-tags
```

And you have released your changes! When you add more changesets again, repeat the process to continue releasing new versions of your packages.

Check out the [CI automation](./automating.md) guide to simplify versioning and publishing so that releasing is as simple as merging a PR.

## First Publishing

TODO
