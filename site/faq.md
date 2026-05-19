# Frequently Asked Questions

Check the [guide](./guide/introduction/getting-started.md) for more detailed explanations of Changesets.

## What is a changeset?

A changeset is a Markdown file that describes a change, and includes YAML frontmatter that describes the packages affected with the respective [semver](https://semver.org) bump types.

Changesets are automatically generated via the CLI:

::: code-group

```bash [npm]
$ npx @changesets/cli
```

```bash [pnpm]
$ pnpm changeset
```

```bash [yarn]
$ yarn changeset
```

:::

They typically look like this:

```md
---
"pkg-a": minor
"pkg-b": patch
---

Summary of the change
```

## Do I need a changeset for every change?

No! Since a changeset describes how a change should be released, changes that don't require a release do not need a changeset.

## Can I manually edit a changeset?

Yes! You can edit the file name, Markdown summary, and YAML frontmatter package names and bump types after they're created or committed. The file name uses random human readable names by default to avoid collisions, but there's no harm in renaming them.

You can also delete them if you feel the changeset is not needed for a previous change as long as it has not been released yet.

## Are changesets removed?

When `changeset version` is run, all changeset files are moved. This is so we only ever use a changeset once. This makes the `.changeset` folder a very bad place to store any other information.
