<script setup lang="ts">
import DiscordLogo from "~icons/logos/discord-icon"
import OCLogo from "~icons/logos/opencollective"
import Socials from "../.vitepress/theme/components/Socials.vue"
</script>

![Banner](/blog/announcing-changesets-v3.png){loading="eager"}

# Announcing Changesets v3

_11 August 2026_

Today, we are excited to announce the release of Changesets v3!

Since the release of v2 seven years ago, this new version brings a host of improvements, cleanups, and modernizations to the Changesets CLI and its packages, and stands as a stepping stone for more ambitious changes we have planned for the future.

Quick links:

- [What is Changesets?](../guide/getting-started.md#what-is-changesets)
- [Frequently Asked Questions](../faq.md)
- [Migrate from v2 to v3](../guide/migration.md)
- [Changelog](https://github.com/changesets/changesets/blob/main/packages/cli/CHANGELOG.md#300)
- [Chat on Discord](https://chat.changesets.dev)

If you or your company uses Changesets, you can help support our work to improve and evolve the project via our <OCLogo /> [Open Collective](https://opencollective.com/changesets) or 💖 [GitHub Sponsors](https://github.com/sponsors/changesets).

## The New Stuff

::: danger Breaking changes
Check out the [Migrate from v2 to v3](../guide/migration.md) guide for a full list of breaking changes.
:::

### Documentation Website

You are currently reading this post on our new website: https://changesets.dev!

With new and re-written docs, we hope this makes it easier to get started with Changesets and find the information you need.

### Modernized Tooling

All Changesets packages have been updated to ESM-only and require Node.js `^22.11 || ^24 || >=26`. The install size and number of dependencies have also been greatly reduced:

- Install size: 16.1MB -> 2.1MB
- Dependencies: 95 -> 39

Internally, we are now using [pnpm](https://pnpm.io), [tsdown](https://tsdown.dev), [rolldown](https://rolldown.rs), [vitest](https://vitest.dev), [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), and more to develop and build our packages.

![Diagram showing install size shrinking by 88%](../assets/size-diff-dark.excalidraw.svg){.dark .no-shadow width="200"}
![Diagram showing install size shrinking by 88%](../assets/size-diff-light.excalidraw.svg){.light .no-shadow width="200"}

### Less aggressive peer dependency bumping

Previously, if Changesets saw a minor version bump, it would bump peer dependents by a **major** version, even if dependent's usage of the package hasn't been broken.

Now, all change types will bump peer dependents by a **patch** version, while authors can still mark the dependent as having a major change in the same changeset file if needed.

This has been the most requested change to Changesets for years (as can be seen in the [closed issues](https://github.com/changesets/changesets/pull/2090)), and we're happy to finally release it!

![graph showing that peer dependents are bumped by patch versions instead of major](../assets/peer-bump-dark.excalidraw.svg){.dark .no-shadow width="420"}
![graph showing that peer dependents are bumped by patch versions instead of major](../assets/peer-bump-light.excalidraw.svg){.light .no-shadow width="420"}

### More robust and flexible version, pack, and publish flows

We have created new commands and GitHub Actions to improve automated publishing workflows.

This allows users to implement a "build, pack, and publish" flow,
[the recommended way to publish packages by the e18e community](https://e18e.dev/docs/publishing.html#standard-workflow).

Check out the new [Automating Changesets](../guide/automating#how-do-i-run-the-version-and-publish-commands) guide for more information.

::: info Regarding staged publishing
We are working on it, and it will be included in the next feature update.
:::

<!-- https://lexidraw.app/#atproto=did:plc:skqg5gindwkuzjmjub6db6yn,3msdmimnqlf2s -->

![Publishing flow diagram](../assets/pack-then-publish-dark.excalidraw.svg){.dark .no-shadow width="500"}
![Publishing flow diagram](../assets/pack-then-publish-light.excalidraw.svg){.light .no-shadow width="500"}

### Improved CLI argument parsing and UX

Changesets now uses [`cac`](https://npmx.dev/cac) for CLI arguments and help messages, and [`@clack/prompts`](https://npmx.dev/@clack/prompts) for CLI prompts and rendering, which should make the CLI prettier and easier to use.

<!-- https://lexidraw.app/#atproto=did:plc:skqg5gindwkuzjmjub6db6yn,3mskqppq5nk2u -->

![cli flow example](../assets/cli-example.webp)

### Use installed formatters to format changelogs

Changesets now defaults to using any supported formatters it finds installed in the project, instead of pulling in a (potentially duplicate) Prettier version.

It supports detecting `prettier`, `oxfmt`, `deno`, and `dprint`, using our new [`@changesets/format`](https://npmx.dev/@changesets/format) package.

Check the [migration guide](../guide/migration.md#replace-prettier-with-format) for how to configure it.

## Thanks

This release was lead by the new Changesets team, including:

- Mateusz Burzyński <Socials bsky="andarist.bsky.social" github="Andarist" />
- Bjorn Lu <Socials bsky="bluwy.me" github="bluwy" />
- Adam Haglund <Socials bsky="haglund.dev" github="beeequeue" />

We'd also like to thank all contributors who have helped discuss, test, and improve Changesets v3 during its development.

If you're interested in helping the future of Changesets, come join us on <DiscordLogo /> [Discord](https://chat.changesets.dev)!

As Changesets remains one of the most popular release tool in the npm ecosystem, with more than 3M weekly downloads, we'd like to thank everyone who has supported Changesets over the years.
