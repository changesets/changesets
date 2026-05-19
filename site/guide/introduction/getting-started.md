# Getting Started

## What is Changesets?

Changesets has several meanings that are sometimes used interchangeably:

1. It is a tool to manage package versions and changelog generation in a project. It is designed to work in [monorepos](https://monorepo.tools) as well as single package repos.

2. It is also a workflow that allows contributors to describe what their changes are and how they should be released.

3. A change description is also known as a "changeset". Typically represented as markdown file, it records the affected packages, the type of change following [semver](https://semver.org), and the change summary to be added to the changelog.

<br>

The Changesets development loop looks like this:

1. When making a change, e.g. via a git commit or a PR, a changeset is added alongside.
2. When a release is ready, the version command is run which consumes all the changesets and updates the package versions and changelogs.
3. Then, the publish command is run to publish the new versions of packages.

The last two steps can be automated in CI.

## Setting Up

::: code-group

```bash [npm]
$ npm install --save-dev @changesets/cli
```

```bash [pnpm]
$ pnpm add -D @changesets/cli
```

```bash [yarn]
$ yarn add -D @changesets/cli
```

:::

Next, run `init` to set up the `.changeset` folder in your project:

::: code-group

```bash [npm]
$ npx @changesets/cli init
```

```bash [pnpm]
$ pnpm changeset init
```

```bash [yarn]
$ yarn changeset init
```

:::

Now, whenever you make a change, you can create a changeset through the CLI:

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

::: tip Not every change requires a changeset

Since a changeset describes how a change should be released, changes that don't require a release do not need a changeset. As such, it is **not recommended** to block contributions in the absence of a changeset.

:::
