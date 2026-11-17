# Getting Started

## What is Changesets?

Changesets has several meanings that are used interchangeably:

1. It is a tool to manage package versions and changelog generation in a project, designed to work in [monorepos](https://monorepo.tools) as well as single package repos.

2. It is [a workflow](#usage) that allows contributors to describe what their changes are and how they should be released.

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

These files are the foundation of the Changesets workflow.

## Install Requirements

Changesets requires [Node.js](https://nodejs.org) `^22.11 || ^24 || >=26` and supports these package managers:

- [pnpm](https://pnpm.io) `>=10.0.0`
- [npm](https://www.npmjs.com) `>=10.9.0`
- [yarn](https://yarnpkg.com) `>=4.5.2`

Lower versions may still work but are not guaranteed nor tested.

::: tip Selecting a package manager
We recommend using pnpm as it has safer security defaults and better monorepo support. However, we also support other package managers if you prefer them.
:::

## Setting Up

Install the Changesets CLI:

::: code-group

```bash [pnpm]
$ pnpm add -D @changesets/cli
```

```bash [npm]
$ npm install -D @changesets/cli
```

```bash [yarn]
$ yarn add -D @changesets/cli
```

:::

And run `init` to set up the `.changeset` folder in your project:

::: code-group

```bash [pnpm]
$ pnpm changeset init
```

```bash [npm]
$ npx @changesets/cli init
```

```bash [yarn]
$ yarn changeset init
```

:::

Your project is now using Changesets!

## Usage

Whenever you make a change, e.g. via a git commit or a PR, create a changeset alongside with the CLI:

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

::: tip Not every change requires a changeset
Since a changeset describes how a change should be released, changes that don't require a release do not need a changeset. As such, we **do not recommend** blocking contributions in the absence of a changeset.
:::

Once you have accumulated some changesets, check out the [Versioning and Publishing](./versioning-and-publishing.md) guide to learn how to release your changes.

See also the [CLI reference](./cli.md) to learn more about the available CLI commands.
