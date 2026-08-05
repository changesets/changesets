# Announcing Changesets v3

_10 August 2026_

![Banner](/blog/announcing-changesets-v3.png)

Today, we are excited to announce the release of Changesets v3. Since the release of v2 seven years ago, this new version brings a host of improvements, cleanups, and modernizations to the Changesets CLI and its packages, and stands as a stepping stone for more ambitious changes we have planned for the future.

Quick links:

- [What is Changesets?](/guide/getting-started#what-is-changesets)
- [Migrate from v2 to v3](/guide/migration)
- [Changelog](https://github.com/changesets/changesets/blob/main/packages/cli/CHANGELOG.md)
- [Chat on Discord](https://chat.changesets.dev)

## Thanks

This release was lead by the new Changesets team, including:

- Mateusz Burzyński ([@Andarist](https://github.com/Andarist))
- Bjorn Lu ([@bluwy](https://github.com/bluwy))
- Adam Haglund ([@beeequeue](https://github.com/beeequeue))

We'd like to thank all contributors who have helped discuss, test, and improve Changesets v3 during its development. If you're interested in helping the future of Changesets, come join us on [Discord](https://chat.changesets.dev).

As Changesets remains one of the most popular release tool in the npm ecosystem, with more than 3M weekly downloads, we'd like to thank everyone who has supported Changesets over the years.

If you or your company uses Changesets, you can help support our work to improve and evolve the project via our Open Collective or GitHub Sponsors.

<!-- TODO: link to sponsors, or add image links? -->

## Highlights

### New Website

You are currently reading this post on our new website! https://changesets.dev. With new and re-written docs, we hope this makes it easier to get started with Changesets and find the information you need.

### Modernized Tooling

All Changesets packages have been updated to ESM-only and require Node.js `^22.11 || ^24 || >=26`. The install size and number of dependencies have also been greatly reduced:

- Install size: 16.1MB -> 2.1MB
- Dependencies: 95 -> 39

Internally, we are now using [pnpm](https://pnpm.io), [tsdown](https://tsdown.dev), [rolldown](https://rolldown.rs), [vitest](https://vitest.dev), [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), and more to develop and build our packages.

### ... and more!

- [Less aggressive peer dependency bumping](#less-aggressive-peer-dependency-bumping)
- [More robust version, pack, and publish flows](#)
- [More flexible GitHub Actions workflows setups](#)
- [Use installed formatters to format changelogs by default](#use-installed-formatters-to-format-changelogs)
- [Re-written support for pnpm, npm, and yarn package managers](#)
- [Greatly simplified pre-release metadata](#)
- [More robust config loading and validation](#)

<!-- TODO: might need to update link -->

Check out the [Migrate from v2 to v3](/guide/migration) guide for a full list of breaking changes.

### Less aggressive peer dependency bumping

Previously, if Changesets saw a minor version bump it would bump peer dependents by a **major** version, even if dependent's usage of the package hasn't broken.

Now, all change types will bump peer dependents by a **patch** version, while authors can still mark the dependent as having a major change in the same changseset file if needed.

This has been the most requested change to Changesets for years (as can be seen in the [closed issues](https://github.com/changesets/changesets/pull/2090)), and we're happy to finally release it!

<!-- TODO: add image/graph/text example -->

### Improved CLI argument parsing and UX

Changesets now uses [`cac`](https://npmx.dev/cac) for CLI arguments and help messages rather than our old custom implementation,
and we use [`@clack/prompts`](https://npmx.dev/@clack/prompts) for CLI prompts and rendering, which should make the CLI prettier and easier to use.

![cli flow example](/blog/cli-example.webp)

### Use installed formatters to format changelogs

Changesets now defaults to using any supported formatters it finds installed in the project, instead of pulling in a (potentially duplicate) Prettier version!

It uses our new package [`@changesets/format`](https://npmx.dev/@changesets/format) which so far supports `dprint`, `deno`, `oxfmt`, `biome`, and `prettier`.

<!-- TODO: needs link -->

You can see the [relevant section in the migration guide]() for how to configure it.
