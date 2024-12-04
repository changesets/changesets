# What are changesets?

The changesets workflow is designed to help when people are making changes, all the way through to publishing. It lets contributors declare how their changes should be released, then we automate updating `package versions`, and `changelogs`, and `publishing new versions` of packages based on the provided information.

Changesets has a focus on solving these problems for multi-package repositories, and keeps packages that rely on each other within the multi-package repository up-to-date, as well as making it easy to make changes to groups of packages.

> [!NOTE]
> Just want to try it out? Skip to the [Getting Started](/guide/intro/getting-started) page.

## How do we do that?

A changeset is an intent to release a set of packages at particular semver bump types with a summary of the changes made.

The `@changesets/cli` package allows you to write changeset files as you make changes, then combine `any number of changesets` into a release, that flattens the bump-types into a single release per package, handles internal dependencies in a multi-package-repository, and updates changelogs, as well as release all updated packages from a mono-repository with one command.
