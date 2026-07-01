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

## What distinguishes this from other versioning tools

If you have been looking at automating versioning previously, you may have come across [Release Please](https://github.com/googleapis/release-please) or [Semantic Release](https://github.com/semantic-release/semantic-release). It's good to understand how changesets operate differently.

1. Changesets are designed for monorepos first. Changesets allow you to group linked packages, define fixed packages, and explicitly declare whether an internal dependency bump should trigger a patch bump on the consuming package.

2. We store our change intent in dedicated Markdown files alongside your code, rather than relying on strict git commit message parsing. See the above section on why we write files to disc.

3. We use semver for specifying the change. When selecting the kind of change your package is, we do not specify any change types beyond `major`, `minor`, or `patch`. In comparison, [conventional commits](https://github.com/conventional-commits/conventionalcommits.org) specify the type of a commit (bug, feat) that gets converted to an appropriate semver type. This is a design decision on our part to push adding this information into the changeset description itself.

### Comparison to Semantic Release

[Semantic Release](https://github.com/semantic-release/semantic-release) focuses on publishing bug fixes and new features as soon as possible without release PRs. With the default CI for Semantic Release, conventional commits landing on the specified branch are published immediately.

While monorepo equivalents (like [Multi Semantic Release](https://github.com/dhoulb/multi-semantic-release) or [Lerna Semantic Release (unmaintained)](https://github.com/atlassian/lerna-semantic-release)) attempt to adapt it for multi-package repositories, standard Semantic Release is designed for single-package repositories.

### Comparison to Release Please

[Release Please](https://github.com/googleapis/release-please) takes a similar approach to semantic release, where conventional commits determine the semver bump. One difference to semantic release - and a similarity to changesets - is the automatic creation of release PRs that need to be merged to trigger a new release.

However, Release Please does not manage publication of packages or complex branch management.

While tools like Release Please support monorepos, Changesets deeply integrates with workspace topologies - giving you fine-grained control over how internal dependency bumps (like `peerDependencies`) cascade through linked packages.

A big advantage of Release Please is its language independence. It supports [15+ strategies](https://github.com/googleapis/release-please#strategy-language-types-supported). There are community-driven ports of changesets for other languages though, like [C#](https://github.com/solarwinds/net-changesets), [Rust](https://github.com/knope-dev/changesets) and [Go](https://github.com/nesymno/changesets).

## The versioning of peer dependencies

Currently, if you list a package as a `peerDependency` of another package, this causes the package with the `peerDependency` to
be released as a `major` change. This is because `peerDependency` changes will not be caught by a package installation.

This decision is open for discussion.

## How Changesets interacts with Git

Changesets core flow of adding changesets, versioning packages/writing changelogs, and publishing packages should work without Git. Using Git in a way where the user doesn't explicitly ask to do something that involves Git such as showing changed packages in the add command shouldn't show an error if Git fails for any reason. Using Git in a way where the user explicitly chooses to use Git such as using the commit option or `status --since main`, Changesets should log an error and fail with a non-zero exit code.
