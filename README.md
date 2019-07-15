# 🦋 changesets 🦋

> A way to manage your versioning and changelogs with a focus on multi-package repositories

The `changesets` workflow is designed to help from when people are making changes, all the way through to publishing. It lets contributors declare how their changes should be released, then we automate updating package versions, and changelogs, and publishing new versions of packages based on the provided information.

Changesets has a focus on solving these problems for multi-package repositories, and keeps packages that rely on each other within the multi-package repository up-to-date, as well as making it easy to make changes to groups of packages.

## How do we do that?

A `changeset` is an intent to release a set of packages at particular [semver bump types](https://semver.org/) with a summary of the changes made.

The **@changesets/cli** package allows you to write `changeset` files as you make changes, then combine any number of changesets into a release, that flattens the bump-types into a single release per package, handles internal dependencies in a multi-package-repository, and updates changelogs, as well as release all updated packages from a mono-repository with one command.

## How do I get started?

If you just want to jump in to using changesets, the [@changesets/cli](./packages/cli/README.md) docs are where you should head.

If you want a detailed explanation of the the concepts behind changesets, or to understand how you would build on top
of changesets, check out our [detailed-explanation](./docs/detailed-explanation.md)

We also have a [spec](./docs/spec.md)

# Thanks/Inspiration

- [bolt](https://github.com/boltpkg/bolt) - Brought us a strong concept of how packages in a mono-repo should be able to interconnect, and provided the initial infrastructure to get inter-package information.
- [atlaskit](https://atlaskit.atlassian.com) - The original home of the changesets code, and where many of the ideas and processes were fermented.
- [lerna-semantic-release](https://github.com/atlassian/lerna-semantic-release) - put down many of the initial patterns around updating packages within a multi-package-repository, and started us thinking about how to manage dependent packages.
- [Thinkmill](https://www.thinkmill.com.au) - For sponsoring the focused open sourcing of this project, and the version two rearchitecture
