# Getting Started

## What is Changesets?

Changesets has several meanings that are sometimes used interchangeably:

1. It is a tool to manage package versions and changelog generation in a project, designed to work in [monorepos](https://monorepo.tools) as well as single package repos.

2. It is also [a workflow](#usage) that allows contributors to describe what their changes are and how they should be released.

3. It also represents a group of [changeset files](#what-is-a-changeset), which are Markdown files that each describe a change.

::: tip New to Changesets?
If you are contributing to a project that uses Changesets, check out the [frequently asked questions](../faq.md) for a quick introduction to working with changesets.
:::

## Why Changesets?

Changesets is designed to help manage and describe changes, all the way through to publishing. It lets contributors declare how their changes should be released, and it'll handle updating package versions, changelogs, and publishing based on the provided changesets.

Changesets has a focus on solving these problems for monorepos, keeping packages that rely on each other up to date, as well as making it easy to make changes to groups of packages. Conceptually, the workflow is also beneficial for single package repos.

Read more about the motivation in the [Why Changesets](./why.md) page.

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

The core idea of Changesets revolves around these files.

## Setting Up

Install the Changesets CLI:

::: code-group

```bash [npm]
$ npm install -D @changesets/cli
```

```bash [pnpm]
$ pnpm add -D @changesets/cli
```

```bash [yarn]
$ yarn add -D @changesets/cli
```

:::

And run `init` to set up the `.changeset` folder in your project:

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

Your project is now using Changesets!

## Usage

Whenever you make a change, e.g. via a git commit or a PR, create a changeset alongside with the CLI:

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

Since a changeset describes how a change should be released, changes that don't require a release do not need a changeset. As such, we **do not recommend** blocking contributions in the absence of a changeset.

:::

Once you have accumulated some changesets and are ready to release, you can run the `version` command to update the package versions and changelogs:

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

Review the changes and commit them to your repository. Then, run the `publish` command to publish the new versions of the packages:

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

And you have released your changes! When you make more changes again, repeat the process to continue releasing new versions of your packages.

You can also [automate the version and publish steps](./automating-changesets.md) in CI so that releasing is as simple as merging a PR. Check out the [CLI reference](./cli.md) to learn more about the available CLI commands.
