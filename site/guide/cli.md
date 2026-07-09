<script setup lang="ts">
import { data } from "./cli.data.ts";
</script>

# Command Line Interface

The Changesets CLI is the main way of interacting with changesets. It provides a set of commands that allow you to manage your changesets, version your packages, and publish them.

<div v-html="data.mainHelpMessage" />

## init

<div v-html="data.initHelpMessage" />

This command sets up the `.changeset` folder. It generates a readme and creates a config file through an interactive prompt. You should run this command once when you are setting up Changesets.

## add

<div v-html="data.addHelpMessage" />

This is the main command to interact with the changesets.

It will ask you a series of questions, first about what packages you want to release, then what semver bump type for each package, then it will ask for a summary of the changes. The final step will show the changeset it will generate and confirm that you want to add it.

Once confirmed, the changeset will be written in the `.changeset` folder. If the [`commit`](./config.md#commit) option is enabled, the changeset will be automatically committed to git.

### Empty changesets

If you have [CI that blocks merges](./automating.md#blocking) without a changeset, pass `--empty` to create an empty changeset.

### Changing the base branch

When prompting for packages to release, Changesets will detect and suggest the changed packages since the last commit on [`baseBranch`](./config.md#basebranch). If you want to use a different base branch, tag, or git ref, you can change it with the `--since [branch]` option.

```bash
$ changeset --since next
```

## version

<div v-html="data.versionHelpMessage" />

- **Related:** [Versioning and Publishing](./versioning-and-publishing.md#versioning)

This is one of two commands responsible for releasing packages. The `version` command takes changesets that have been made and updates versions and dependencies of packages, as well as writing changelogs. It is responsible for all file changes before publishing to npm.

::: tip Commit the version changes
We recommend making sure changes made from this command are committed before you run publish:

```bash
$ git add .
$ git commit -m "Version packages"
```

:::

### Ignoring packages

The `--ignore` flag allows you to skip packages from being published. This allows you to run partial publishes of the repository. This extends the [`ignore`](./config.md#ignore) option with the same documented caveats.

```bash
$ changeset version --ignore pkg-a --ignore pkg-b
```

### Snapshot releases

You can use the `--snapshot` flag to create a [snapshot release](./snapshot-releases.md), meant for testing purposes only. The suffix for snapshot releases can be customized with `--snapshot-prerelease-template <template>`, which works the same way as the [`snapshot.prereleaseTemplate`](./config.md#snapshotprereleasetemplate) option.

It is highly recommended to read the [Snapshot Releases](./snapshot-releases.md) guide before using this flag.

```bash
$ changeset version --snapshot 'pr#123'
```

## publish

<div v-html="data.publishHelpMessage" />

- **Related:** [Versioning and Publishing](./versioning-and-publishing.md#publishing), [`pack` command](#pack)

This command publishes changes to npm and creates git tags. It works by going into each package, checking if the version it has in its `package.json` is published on npm, and if it's not, run `npm publish` (or with the detected package-manager-specific publish command).

Because this command assumes that the last commit is the version commit, you should not commit any changes between calling `version` and `publish`. These commands are separate to enable you to check if the release changes are accurate.

Git tags for each package are also created by default. This allows users to easily find the code for a specific release. The tags created are in the format of `pkg-name@X.X.X`, or in single-package repos, it is `vX.X.X`. Pass `--no-git-tag` to disable this.

Make sure to push the tags to your git remote after creating them:

```bash
$ git push --follow-tags
```

::: warning Accidental publishes
As the `publish` command automatically publishes versions that are not yet published, it's possible to accidentally publish a new package that has not been versioned before.

For example, when [Automating Changesets](./automating.md) (where it calls `publish` if there are no changesets to create a version PR) or automated [Snapshot Releases](./snapshot-releases.md), it may unintentionally publish the new package. To prevent this, make sure to set `"private": true` in the `package.json` of packages that should not be published.
:::

### OTP

When publishing locally, you may be prompted for a one-time password (OTP) if your have two-factor authentication enabled on npm. You can provide this OTP directly with the `--otp <code>` flag to avoid the prompt.

```bash
$ changeset publish --otp 123456
```

### NPM dist-tags

Published versions are tagged on npm with `latest` by default. You may want to change the [dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) when publishing [snapshot releases](./snapshot-releases.md) to prevent them from being installed by default. Pass `--tag <name>` to publish with a different dist-tag.

```bash
$ changeset publish --tag beta
```

## publish-plan

<div v-html="data.publishPlanHelpMessage" />

- **Related:** [Versioning and Publishing](./versioning-and-publishing.md#publishing), [`pack` command](#pack), [`publish` command](#publish)

Show packages that are ready to publish or tag. If `--output` is passed, the JSON will be written to the file which can be used later by the `pack` and `publish` commands. `--output` is marked experimental as the format may change between patches, however the output will always work if passed to the same version of `pack` and `publish` commands.

This is useful for CI pipelines that want to split the version and publish steps to check if there are packages to publish.

## pack

<div v-html="data.packHelpMessage" />

- **Related:** [Versioning and Publishing](./versioning-and-publishing.md#publishing), [`publish` command](#publish)

Pack publishable packages into tarballs. The `--out-dir` flag is required to write the output to the directory, which the same directory can be passed to `publish --from-pack-dir` so the `publish` command picks up the tarballs and publishes them.

This is useful for CI pipelines that want to split the build and publish steps.

## status

<div v-html="data.statusHelpMessage" />

The status command provides information about the changesets that currently exist. If there are changes to packages but no changesets are present, it exits with code `1`.

### JSON output

Pass `--output <file>` write the status output as a JSON file so it can be consumed by other tools.

```bash
$ changeset status --output status.json
```

### Status since a specific branch

You can use `--since <branch>` with a different branch, tag, or git ref to only display the information about changesets since that point.

```bash
$ changeset status --since next
```

::: warning
`status` will fail if you are in the middle of running `version` or `publish`. If you want to get changeset status at the time of a version increase and publish, you need to run it immediately before running `version`.
:::

## git-tag

<div v-html="data.gitTagHelpMessage" />

The `git-tag` command creates git tags for the current version of all packages. The tags created are equivalent to those created by the [`publish`](#publish) command, but the `git-tag` command does not publish anything to npm.

This is helpful in situations where a different tool is used to publish packages instead of Changesets. The tags created are in the format `pkg-name@X.X.X`, or in single-package repos, it is `vX.X.X`. It is expected to run the `version` command first so the created tags are up to date.

## pre

<div v-html="data.preHelpMessage" />

The `pre` command is used to enter or exit [prerelease mode](./prereleases.md). It does not do any versioning but prepares Changesets in a state for prereleases.

When you want to do a prerelease, run `pre enter <tag>` to enter prerelease mode with the given tag, then do the normal release process as usual. When you're ready for a stable release, run `pre exit` and do the normal release process again.

::: warning Prereleases are complicated
Many of the safety rails that Changesets helps you with are taken off in prerelease mode. You may also prefer using [snapshot releases](./snapshot-releases.md) for a slightly less involved process. It is highly recommended to read through the [prereleases](./prereleases.md) documentation before using this command.
:::
