# Why Changesets

## The Problem

When organizing the release of packages, you may end up wanting to group several changes together written by different people and/or over a relatively large period of time. The best time to capture this information is when submitting a PR (when it is fresh in your mind), not when you eventually go to batch and release these changes.

Git is a bad place to store this information, as it discourages writing detailed change descriptions. You want to allow people to provide as much documentation for the change as they want.

## The Solution, Changesets

The best way to think about a changeset as separate to either a changelog or a version bump is that a changeset is an "intent to change", carrying two key bits of information: **versioning** and **changelogs**.

### Versioning

The versioning information can be represented with [semver](https://semver.org) as major, minor, or patch.

In a monorepo, we can also encode information about any other packages that should be re-released as part of this change. This ensures that if you upgrade to the latest of all the packages, they are all compatible. The current implementation is heavily informed by [bolt](https://github.com/boltpkg/bolt)'s opinion on version compatibility.

### Changelogs

The changelog information can be stored as a Markdown snippet.

As storing this information directly in git is problematic, we store it in the filesystem using the following structure:

```
 | .changeset/
 | |- UNIQUE_ID.md
```

## The Result

A changeset is a Markdown file with YAML frontmatter. The contents of the Markdown is the change summary which will be written to the changelog and the YAML frontmatter describes the packages that have changed and their respective semver bump types:

```md
---
"pkg-a": minor
"pkg-b": patch
---

Summary of the change
```

This is useful because it breaks versioning into two steps:

1. Adding a changeset - can be done in a PR, by a contributor, while the change is fresh in their mind.
2. Versioning - combines all changesets, creates one version bump for each package based on the maximum version bump of each package, updates dependencies where needed, and writes changelogs. Can then be reviewed as an aggregate.

## The Tooling that Makes this Worthwhile

1. The [Changesets CLI](./cli.md) helps with generating new changesets, versioning, and publishing packages.
2. The [Changesets GitHub Bot](./automating.md#how-do-i-ensure-pull-requests-have-changesets) ensure PRs have changesets and prompts for creating them.
3. The [Changesets GitHub Action](./automating.md#how-do-i-run-the-version-and-publish-commands) automates versioning and publishing in CI so releasing is as simple as merging a PR.

## Benefits for Single Package Repos

Changesets are designed first and foremost to handle versioning in monorepos, where interdependencies flowing through the system are important to understand and capture.

Conceptually though, the benefits of changesets are detachable from this. The workflow overall leads to an improvement in pull requests that helps increase confidence in versioning decisions and changelog entries.
