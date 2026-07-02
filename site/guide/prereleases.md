# Prereleases

::: warning Please read through the guide before using prereleases
Prereleases are very complicated! Using them requires a thorough understanding of all parts of npm publishes. Mistakes can lead to repository and publish states that are very hard to fix.
:::

Prereleases allow you to release alpha/beta versions of your packages before you do a stable release, e.g. publishing versions like `1.0.0-beta.0` before you publish `1.0.0`. This allows you to make frequent breaking changes and get feedback before you do a stable release.

Changesets can be configured to enter prerelease mode which will publish all packages as prerelease versions. When you're ready to do a stable release, you can exit prerelease mode and publish everything as stable versions. Note that you cannot enter prerelease mode for only a subset of packages.

It is also recommended to **run prereleases on a different branch** than the default branch, so that you can continue making changes to your stable version for important bug and security fixes. Alternatively, make a copy of the default branch, e.g. `v1`, before entering prerelease for `v2`. See the [Backporting Changes](./backporting-changes.md) guide for more information for making changes to older versions.

## Enter Prerelease Mode

::: tip Make one last stable release
Before entering prerelease mode, consider making another stable release to clear the existing changesets. Otherwise, they will be included in the first prerelease.
:::

Run [`pre enter <tag>`](./cli.md#pre) to enter prerelease mode with the given tag. The tag will be used in the versions, e.g. if the tag is `beta`, the versions will look like `1.0.0-beta.0`, and for the npm [dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) when you publish.

::: code-group

```bash [pnpm]
$ pnpm changeset pre enter beta
```

```bash [npm]
$ npx @changesets/cli pre enter beta
```

```bash [yarn]
$ yarn changeset pre enter beta
```

:::

This will generate a `pre.json` file in the `.changeset` folder that stores the current prerelease state. See the type definition of `PreState` in [`@changesets/types`](https://github.com/changesets/changesets/tree/main/packages/types) for more information of the state.

::: info Prerelease mode on a separate branch

- Update the [`baseBranch`](./config.md#baseBranch) option with the branch name. This allows the [`add`](./cli.md#add) command to properly detect the changed packages.

- If you have set up CI to [automatically run version and publish](./automating.md#how-do-i-run-the-version-and-publish-commands), make sure to allow running the workflow for this branch too.

:::

Commit the changes and Changesets will now be in prerelease mode.

## Releasing Prerelease Versions

When you want to release a prerelease version, you can run the [`version`](./cli.md#version) and [`publish`](./cli.md#publish) commands as usual. See the [Versioning and Publishing](./versioning-and-publishing.md) guide for the usual flow.

The only difference is that the versions will have the prerelease tag postfixed and the dist-tag will be the tag you specified when you entered prerelease mode.

If you have set up CI to [automatically run version and publish](./automating.md#how-do-i-run-the-version-and-publish-commands), you should see a `version` PR with the `(<tag>)` postfixed in the title.

### Example

Say we have three packages, `pkg-a`, `pkg-b`, and `pkg-c`:

```
pkg-a @ version 1.0.0
  depends on pkg-b at range ^2.0.0
pkg-b @ version 2.0.0
pkg-c @ version 3.0.0
```

```md [.changeset/i-love-changesets.md]
---
"pkg-b": minor
---
```

When running the `version` command, `pkg-b` will be released as `2.1.0-beta.0`. An important note is that this will bump dependent packages that wouldn't be bumped in normal releases because prerelease versions are not satisfied by most semver ranges, e.g. `2.1.0-beta.0` does not satisfy `^2.0.0`.

The packages should now look like this:

```
pkg-a @ version 1.0.1-beta.0
  depends on pkg-b at range ^2.1.0-beta.0
pkg-b @ version 2.1.0-beta.0
pkg-c @ version 3.0.0
```

Then, run the `publish` command as usual and it will publish the prerelease versions to npm with the `beta` dist-tag.

::: danger Publishing new packages while in prerelease mode
If you publish a **new**, unpublished package for the first time in prerelease mode, it will **still** be published with the `latest` tag alongside the prerelease tag.

This is because npm enforces that all packages have a `latest` tagged version.
:::

## Exit Prerelease Mode

When you're ready to do a stable release, you can exit prerelease mode with the [`pre exit`](./cli.md#pre) command. This will set an intent to exit prerelease mode in the `pre.json` file but it won't do any actual versioning.

::: info Prerelease mode on a separate branch

Make sure to revert the changes you made before merging back into the default branch:

- Update the [`baseBranch`](./config.md#baseBranch) option back to the default branch.

- If you have set up CI to [automatically run version and publish](./automating.md#how-do-i-run-the-version-and-publish-commands), remove any configuration to run the workflow for the prerelease branch.

- You can now run the `exit` command, commit, and merge the changes back into the default branch.

:::

::: code-group

```bash [pnpm]
$ pnpm changeset pre exit
```

```bash [npm]
$ npx @changesets/cli pre exit
```

```bash [yarn]
$ yarn changeset pre exit
```

:::

Make sure to commit the changes.

You can now run the [`version`](./cli.md#version) and [`publish`](./cli.md#publish) commands as usual. The versions will now be released as stable versions without the prerelease tag and published to the `latest` dist-tag.

### Example

Taking the example before, after releasing the stable versions, the packages should now look like this:

```
pkg-a @ version 1.0.1
  depends on pkg-b at range ^2.1.0
pkg-b @ version 2.1.0
pkg-c @ version 3.0.0
```

## Changing the Prerelease Tag

During prerelease mode, you may want to change the tag for different stages of the prerelease, e.g. `alpha` -> `beta` -> `rc`. You can do this by directly changing the `"tag"` value in `.changeset/pre.json`:

```json [.changeset/pre.json]
{
  "tag": "alpha", // [!code --]
  "tag": "beta" // [!code ++]
}
```

If you're using a different branch for prereleases, you do not need to rename the branch for the new tag. Prereleases only uses the specified tag for versions and dist-tags.
