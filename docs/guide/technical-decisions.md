# Technical Decisions

This file is a discussion of some of the rules and design decisions that have gone into making changesets. The goal of all of these has been to make the experience of using changesets easy, while still providing the maximum value possible.

## How changesets are combined

Changesets are designed to be as easy to accumulate as possible. As such, when changesets are consumed with `version`, we flatten the version bumps into one single bump at the highest semver range specified.

For example: if you run `version`, and we have `packageA` at `1.1.1`, which has two `minor` changesets, and one `patch` changeset, we will bump `packageA` to `1.2.0`.

This allows changesets to be added and accumulated safely, with the knowledge that packages will only be released once at an appropriate version for the combined set of changesets, while still ensuring each change is captured in the changelog, with an indication of what kind of change it is.

## How dependencies are bumped

> [!NOTE]
> This refers specifically to a feature of changesets used in monorepos

When changesets are generated, we check to see if the selected packages will leave semver for any other packages within the monorepo.

For example, if I have two packages:

`packageA` at `1.1.1`

and `packageB` at `1.1.0` that depends on `packageA` at `^1.1.0`.

If I add `packageA` to a changeset with a `major` change, the version of `packageB` within the monorepo should also be updated. If it is not, either `packageB` in the monorepo will not use `packageA` in development, or `packageB` in development will not match an installation of `packageB` in production.

As such we end up with a changeset that includes `packageA` as `major` and `packageB` as `patch`.

All updating of dependencies is done as a patch bump. If you want to indicate a more significant change to `packageB` from consuming a new version of `packageA`, we recommend adding a second changeset specifically for `packageB`.

## Why do we write files to disc

There are two reasons we chose to do this. The first is so the changeset descriptions are editable after creation, and a user can go in and change this as they desire. The second is that it means we are unopinionated about your git workflows, with squashing and modifying commits being completely safe, without fear of breaking a release.

## How Changesets differs from conventional commit-based tools

While many versioning tools rely on conventional commits to determine releases, Changesets was built with a different philosophy, prioritizing monorepo management and flexible workflows over strict commit message parsing.

1. Monorepo-first design: Changesets is built to manage complex workspace topologies. It allows you to group linked packages, define fixed packages, and explicitly declare how internal dependency bumps cascade through your repository.

2. Intent-based files: Instead of parsing git commit messages, change intent is stored in dedicated Markdown files committed alongside your code. This ensures that release information is preserved regardless of how your git history is squashed or rewritten.

3. Direct Semver selection: When creating a changeset, you directly specify a `major`, `minor`, or `patch` bump. Conventional commit-based tools, by comparison, rely on mapping specific commit types (e.g., `feat`, `fix`) to semver increments. We believe this design choice provides more clarity by keeping the documentation and the versioning intent together.

## The versioning of peer dependencies

Currently, if you list a package as a `peerDependency` of another package, this causes the package with the `peerDependency` to
be released as a `major` change. This is because `peerDependency` changes will not be caught by a package installation.

This decision is open for discussion.

## How Changesets interacts with Git

Changesets core flow of adding changesets, versioning packages/writing changelogs, and publishing packages should work without Git. Using Git in a way where the user doesn't explicitly ask to do something that involves Git such as showing changed packages in the add command shouldn't show an error if Git fails for any reason. Using Git in a way where the user explicitly chooses to use Git such as using the commit option or `status --since main`, Changesets should log an error and fail with a non-zero exit code.
