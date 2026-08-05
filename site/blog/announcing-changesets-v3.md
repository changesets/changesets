# Announcing Changesets v3

_10 August 2026_

![Banner](/blog/announcing-changesets-v3.png)

Today, we are excited to announce the release of Changesets v3. Since the release of v2 seven years ago, this new version brings a host of improvements, cleanups, and modernizations to the Changesets CLI and its packages, and stands as a stepping stone for more ambitious changes we have planned for the future.

Quick links:

- [What is Changesets?](/guide/getting-started#what-is-changesets)
- [Migrate from v2 to v3](/guide/migration)
- [Changelog](https://github.com/changesets/changesets/blob/main/packages/cli/CHANGELOG.md)
- [Chat on Discord](https://chat.changesets.dev)

## Highlights

### New Website

You are currently reading this post on our new website! https://changesets.dev. With new and re-written docs, we hope this makes it easier to get started with Changesets and find the information you need.

### Modernized Tooling

All Changesets packages have been updated to ESM-only and require Node.js `^22.11 || ^24 || >=26`. The install size and number of dependencies have also been greatly reduced:

- Install size: 16.1MB -> 2.1MB
- Dependencies: 95 -> 39

Internally, we are now using [pnpm](https://pnpm.io), [tsdown](https://tsdown.dev), [rolldown](https://rolldown.rs), [vitest](https://vitest.dev), [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), and more to develop and build our packages.

### New Features

We have also added a number of new features, notably:

- Re-written support for pnpm, npm, and yarn package managers
- More robust version, pack, and publish flows
- Use installed formatters to format changelogs by default
- Less aggressive peer dependency bumping
- Greatly simplified `.changeset/pre.json` file
- More robust config loading and validation
- Improved CLI argument parsing and rendering output, using [cac](https://github.com/cacjs/cac) and [clack](https://github.com/bombshell-dev/clack)
- More flexible GitHub Actions workflows setup

### Breaking Changes

Check the [Migrate from v2 to v3](/guide/migration) guide for the the full list of breaking changes.

## Thanks

This release was lead by the Changesets team, including:

- Mateusz Burzyński ([@Andarist](https://github.com/Andarist))
- Bjorn Lu ([@bluwy](https://github.com/bluwy))
- Adam Haglund ([@beeequeue](https://github.com/beeequeue))

We'd like to thank all contributors who have helped discuss, test, and improve Changesets v3 during its development. If you're interested in helping the future of Changesets, come join us on [Discord](https://chat.changesets.dev).

As Changesets remains one of the most popular release tool in the npm ecosystem, with more than 3M weekly downloads, we'd like to thank everyone who has supported Changesets over the years.
