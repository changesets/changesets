## @changeset/cli 🦋

The primary implementation of [changesets](https://github.com/Noviny/changesets). Helps you manage the versioning
and changelog entries for your packages, with a focus on versioning within a mono-repository (though we support
single-package repositories too).

This package is intended as a successor to `@atlaskit/build-releases` with a more general focus. It works in
[bolt](https://www.npmjs.com/package/bolt) multi-package repositories, [yarn workspaces] multi-package repositories, and
in single-package repositories.

## Getting Started

If you are installing this in a monorepo run

```
yarn add @changesets/cli
yarn changeset init
```

otherwise run

```
yarn add --dev @changesets/cli
yarn changeset init
```

From here you are set up to use changesets. Add your first changeset by running

```
yarn changeset
```

and following the prompts that you are presented with.

Below you can find a basic workflow for maintainers to help them use changesets, which you can vary to meet your own needs.

## Core Concepts

The core concept that `changesets` follows is that contributors to a repository should be able to declare an intent to release, and that multiple intents should be able to be combined sensibly. Sensibly here refers to if there is one intent to release button as a 'minor' and another to release button as a 'patch', only one release will be made, at the higher of the two versions.

A single `changeset` is an intent to release stored as data, with the information we need to combine multiple changesets and coordinate releases. It will also update internal dependencies within a multi-package repository.

## Base workflow

Contributor runs:

```
yarn changeset
```

or

```
npx changeset
```

and answers the provided questions.

When the maintainer wants to release packages, they should run

```
yarn changeset bump
```

or

```
npx changeset bump
```

and then

```
yarn changeset release
```

or

```
npx changeset release
```

The commands are explained further below.

## Commands

### initialize

```
changeset init
```

This command sets up the `.changeset` folder. It generates a readme and a config file. The config file includes the default options, as well as comments on what these options represent. You should run this command once, when you are setting up `changesets`.

### add

```
changeset [--commit]
```

or

```
changeset add [--commit]
```

This command will ask you a series of questions, first about what packages you want to release, then what version for each package, then it will ask for a summary of the entire changeset. At the final step it will show the changeset it will generate, and confirm that you want to add it.

Once confirmed, the changeset will be written into two files:

- `.changeset/{HASH}/changes.md` - this includes the summary message, and is safe to edit and expand on.
- `.changeset/{HASH}/changes.json` - this is the intent to update and should not be manually edited.

The information in the `changes.json` will look like:

```json
{
  "releases": [
    { "name": "@atlaskit/analytics-listeners", "type": "major" },
    { "name": "@atlaskit/website", "type": "patch" }
  ],
  "dependents": [
    {
      "name": "@atlaskit/global-navigation",
      "type": "patch",
      "dependencies": ["@atlaskit/analytics-listeners"]
    }
  ]
}
```

You can pass the option `--commit`, or provide this in the config. Commit is false by default. If it is true, the command will add the updated changeset files and then commit them.

### bump

```
changeset bump [--update-changelog] [--commit]
```

Updates the versions for all packages (and depdendencies) described in changesets since last release.

Will also create/append to a CHANGELOG file for each package using the summaries from the changesets.

We recommend making sure changes made from this commmand are merged back into master before you run `release.

This command will read then delete changesets on disk, ensuring that they are only used once.

`--update-changelog` (default true) - Sets whether you want changesets to write out changelog files.

`--commit` (default false) - If true, running this command will automatically commit the changes it made. Note this will cause CI to be skipped.

### release

```
changeset release [--public] [--otp={token}]
```

Publishes to NPM repo, and creates tags. Because this command assumes that last commit is the release commit you should not commit any changes between calling `version` and `publish`. These commands are separate to enable you to check if release commit is acurate.

`--public` - enables the `--access-public` flag when publishing. This is required if trying to publish public scoped packages.

`--otp={token}` - allows you to provide an npm one-time password if you have auth and writes enabled on npm. The CLI also prompts for the OTP if it's not provided with the `--otp` option.

**NOTE:** You will still need to push your changes back to master after this

```
git push --follow-tags
```

### status

```
status [--verbose] [--output={filePath}] [--since-master]
```

The status command provides information about the changesets that currently exist. If there are no changesets present, it exits with an error status code.

Use verbose if you want to know the new versions, and get a link to the relevant changeset summary.

You can use `output` to write the json object of the status out, for consumption by other tools, such as CI.

You can use the `since-master flag to only display information about changesets since the master branch. While this can be
used to add a CI check for changesets, we recommend not doing this. We instead recommend using the [changeset bot](https://github.com/apps/changeset-bot)
to detect pull requests missing changesets, as not all pull requests need one.

### Bumping peerDependencies

In almost all circumstances, internal packages will be bumped as a patch. The one exception is when the dependency is a `peerDependency`, in which case the change will become a major.
