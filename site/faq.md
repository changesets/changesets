# Frequently Asked Questions

Check the [guide](./guide/getting-started.md) to learn more about Changesets.

## What is a changeset?

A changeset is a Markdown file with YAML frontmatter. The contents of the Markdown is the change summary which will be written to the changelog and the YAML frontmatter describes the packages that have changed and their respective [semver](https://semver.org) bump types.

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

## How do I add a changeset?

Run the CLI to generate a changeset:

::: code-group

```bash [pnpm]
$ pnpm changeset
```

```bash [npm]
$ npx @changesets/cli
```

```bash [yarn]
$ yarn changeset
```

:::

And follow the prompts:

1. If the project has multiple packages, select the packages you want to include.
   - Use <kbd>↑</kbd> and <kbd>↓</kbd> to navigate to packages
   - Press <kbd>space</kbd> to select a package.
   - Press <kbd>enter</kbd> when all desired packages are selected.
2. Select the appropriate [semver](https://semver.org) bump type for each selected package.
3. Provide a message to go alongside the changeset. This will be written into the changelog when the next release occurs.

   While not every changeset is going to need a huge amount of detail, a good idea of what should be in a changeset is:
   - WHAT the change is
   - WHY the change was made
   - HOW a consumer should update their code

A new changeset file will be created in the `.changeset` folder. Once you are happy with the changeset, commit the file to your branch.

## Can I add more than one changeset in a PR?

Yes! Changesets are designed to stack, so there's no problem with adding multiple. You might want to add more than one changeset when:

- You want to release multiple packages with different changelog entries
- You have made multiple changes to a package that should each be called out separately

## Can I manually edit a changeset?

Yes! You can edit the file name, Markdown summary, and YAML frontmatter package names and bump types after they're created or committed. The file name uses random human readable names by default to avoid collisions, but there's no harm in renaming them.

You can also delete them if you feel the changeset is not needed for a previous change as long as it has not been released yet.

## Are changesets removed?

When `changeset version` is run, all changeset files are removed. This is so we only ever use a changeset once. This makes the `.changeset` folder a very bad place to store any other information.
