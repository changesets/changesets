# Command Line Interface

The Changesets CLI is the main way of interacting with changesets. It provides a set of commands that allow you to manage your changesets, version your packages, and publish them.

<!-- Manually synced from `pnpm changeset --help` -->

```bash
Usage:
  $ changeset [command] [options]

Commands:
  init                    Initialize a new changesets setup
  add                     Add a new changeset (default)
  version                 Version packages and create changelogs
  publish                 Publish packages to npm and create git tags
  status                  Show the changesets that currently exist
  tag                     Create git tags for the current version of all packages
  pre <enter|exit> [tag]  Enter or exit prerelease mode (tag required for enter)
```

## init

```bash
Usage:
  $ changeset init
```

This command sets up the `.changeset` folder. It generates a readme and a config file with the default options. You should run this command once when setting up Changesets.

## add

```bash
Usage:
  $ changeset add
  $ changeset

Options:
  --empty               Add an empty changeset
  --open                Open the changeset in the editor after creating it
  --since <branch>      Detect changed packages since the provided git ref
  -m, --message <text>  Directly provide a message to the changeset

Examples:
  $ changeset -m 'Description'
  $ changeset --open --since main
```

This is the main command to interact with the changesets.

It will ask you a series of questions, first about what packages you want to release, then what semver bump type for each package, then it will ask for a summary of the changes. The final step will show the changeset it will generate and confirm that you want to add it.

Once confirmed, the changeset will be written in the `.changeset` folder. If the [`commit`](./configuration-file.md#commit) option is enabled, the changeset will be automatically committed to git.

::: info Empty changesets
If you have [CI that blocks merges](../basic/automating-changesets.md#blocking) without a changeset, pass `--empty` to create an empty changeset.
:::

::: info Changing base branch
When prompting for packages to release, Changesets will detect and suggest the changed packages since the last commit on [`baseBranch`](./configuration-file.md#basebranch). If you want to use a different base branch, tag, or git ref, you can change it with the `--since` option.

```bash
$ changeset --since next
```

:::

## version

```bash
Usage:
  $ changeset version

Options:
  --ignore <pkg>                             Packages to ignore
  --snapshot [name]                          Create a snapshot prerelease
  --snapshot-prerelease-template <template>  Template for snapshot prerelease

Examples:
  $ changeset version
  $ changeset version --snapshot 'pr#123'
```

This is one of two commands responsible for releasing packages. The `version` command takes changesets that have been made and updates versions and dependencies of packages, as well as writing changelogs. It is responsible for all file changes before publishing to npm.

::: tip Merge the version changes
We recommend making sure changes made from this command are merged back into the base branch before you run publish.
:::

::: info Ignoring packages
The `--ignore` flag allows you to skip packages from being published. This allows you to run partial publishes of the repository. This extends the [`ignore`](./configuration-file.md#ignore) option with the same documented caveats.
:::

::: info Snapshot releases
You can use the `--snapshot` flag to create a [snapshot release](../advanced/snapshot-releases.md), meant for testing purposes only. It is highly recommended to read the [Snapshot Release](../advanced/snapshot-releases.md) documentation before using this flag.
:::

## publish

```bash
Usage:
  $ changeset publish

Options:
  --otp <code>  One time password for npm publish
  --tag <name>  Publish with the given npm dist-tag
  --git-tag     Create a git tag for the release

Examples:
  $ changeset publish --otp 123456
  $ changeset publish --tag beta
```

This command publishes changes to npm and creates git tags. It works by going into each package, checking if the version it has in its `package.json` is published on npm, and if it's not, run `npm publish` (or `pnpm publish` etc if detected to be using a different package manager).

Because this command assumes that the last commit is the version commit, you should not commit any changes between calling `version` and `publish`. These commands are separate to enable you to check if the release changes are accurate.

::: info OTP
When publishing locally, you may be prompted for a one-time password (OTP) if your have two-factor authentication enabled on npm. You can provide this OTP directly with the `--otp` flag to avoid the prompt.
:::

::: info NPM dist-tags
Published versions are tagged on npm with `latest` by default. You may want to change the tag when publishing [snapshot releases](../advanced/snapshot-releases.md) to prevent them from being installed by default.
:::

::: info Git tags
Pass `--git-tag` to create git tags for each package published. This allows users to easily find the code for a specific release. The tags created are in the format `pkg-name@X.X.X`, or in single-package repos, it is `vX.X.X`.

After the git tags are created, you will need to push them back up to your git remote:

```bash
$ git push --follow-tags
```

:::

## status

```bash
Usage:
  $ changeset status

Options:
  --since <branch>     Show changesets since the provided git ref
  -v, --verbose        Show more information about the changesets
  -o, --output <file>  Output the status as JSON to a file

Examples:
  $ changeset status --verbose
```

The status command provides information about the changesets that currently exist. If there are no changesets present, it exits with exit code 1.

::: info JSON output
Pass `--output` and the file path to write the status output as JSON, so it can be consumed by other tools.
:::

::: info Status since a specific branch
You can use `--since` with a different branch, tag, or git ref to only display the information about changesets since that point.
:::

::: warning
`status` will fail if you are in the middle of running `version` or `publish`. If you want to get changeset status at the time of a version increase and publish, you need to run it immediately before running `version`.
:::

## tag

```bash
Usage:
  $ changeset tag
```

The `tag` command creates git tags for the current version of all packages. The tags created are equivalent to those created by [`publish --git-tag`](#publish), but the `tag` command does not publish anything to npm.

This is helpful in situations where a different tool is used to publish packages instead of Changesets. The tags created are in the format `pkg-name@X.X.X`, or in single-package repos, it is `vX.X.X`. It is expected to run the `version` command first so the created tags are up to date with the versions in the `package.json` files.

## pre

```bash
Usage:
  $ changeset pre <enter|exit> [tag]
```

The `pre` command is used to enter or exit [prerelease mode](../advanced/prereleases.md). It does not do any versioning but prepares Changesets in a state for prereleases.

When you want to do a prerelease, run `pre enter <tag>` to enter prerelease mode with the given tag, then do the normal release process as usual. When you're ready for a stable release, run `pre exit` and do the normal release process again.

::: warning Prereleases are complicated
Many of the safety rails that Changesets helps you with will be taken off in prerelease mode. You may also prefer using [snapshot releases](../advanced/snapshot-releases.md) for a slightly less involved process. It is highly recommended to read through the [prereleases](../advanced/prereleases.md) documentation before using this command.
:::
