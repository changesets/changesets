## Build Releases

Standalone library to help monorepos that are using bolt to bump version across whole monorepo (especially those internal ones). Heavily depends on bolt to generate and bump versions.

## Core Concepts

The core concept that `@atlaskit/build-releases` follows is that contributors to a mono-repo should be able to declare an intent to release, and that multiple intents should be able to be combined sensibly. Sensibly here refers to if there is one intent to release button as a 'minor' and another to release button as a 'patch', only one release will be made, at the higher of the two versions.

We are using the term `changeset` for this. A changeset is an intent to release stored as data, with tthe information we need to combine multiple changesets and coordinate releases. We also work with bolt's structure to make sure that changesets will create valid new bolt repositories after versioning has occurred.


## Base workflow

Contributor runs:
```
yarn build-releases changeset
```

and answers the provided questions.

When the maintainer wants to release packages, they should run

```
yarn build-releases version
```

and then

```
yarn build-releases publish
```

The commands are explained further below.


## Commands

### initialize

```
yarn build-releases changeset
```

This command sets up the `.changeset` folder. It generates a readme and a config file. The config file includes the default options, as well as comments on what these options represent. You should run this command once, when you are setting up `build-releases`.

### changeset

```
yarn build-releases changeset [--commit]
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
      "dependencies": [
        "@atlaskit/analytics-listeners"
      ]
    }
  ]
}
```

You can pass the option `--commit=true`, or provide this in the config. Commit is false by default. If it is true, the command will add the updated changeset files and then commit them.

### version

```
build-releases version [--noChangelog] [--skipCI] [--commit]
```

Creates release commit with bumped versions for all packages (and depdendencies) described in changeset commits since last release. Should be part of release process on CI.

Will also create/append to a CHANGELOG file for each package using the summaries from the changesets.

The reccomended approach is to run `version`, then push to master, then publish, so that your repo is the source of truth.

```
git push origin master
```

`--noChangelog` - disables the changelog functionality

Example of commit message:

```
RELEASING: Releasing 2 package(s)

Releases:
  @atlaskit/icon@13.3.0
  @atlaskit/reduced-ui-pack@9.2.0

Dependents:
  []

Deleted:
  []

---
{"releases":[{"name":"@atlaskit/icon","commits":["d36f760","7cf05b3"],"version":"13.3.0"},{"name":"@atlaskit/reduced-ui-pack","commits":["d36f760","365460a"],"version":"9.2.0"}],"changesets":[{"commit":"d36f760","summary":"Add new icon"},{"commit":"365460a","summary":"Add new icon for Roadmap"},{"commit":"7cf05b3","summary":"Add new icon for Roadmap"}]}
---

[skip ci]
```

This command will read then delete changeset folders, ensuring that they are only used once.

> `[skip ci]` can be used to prevent this commit from triggering a CI build as the common use case would be to run this in master and then push back to master. We want to avoid the infinite loop there. If you are running version locally, you may need to make another commit after this to trigger your CI.

### publish

```
build-releases publish [--public]
```

Publishes to NPM repo, and creates tags. Because this command assumes that last commit is the release commit you should not commit any changes between calling `version` and `publish`. These commands are separate to enable you to check if release commit is acurate. Should be part of release process on CI.

`--public` - enables the `--access-public` flag when publishing. This is required if trying to publish public scoped packages.

**NOTE:** You will still need to push your changes back to master after this

```
git push --follow-tags
```

### Bumping peerDependencies

In almost all circumstances, internal packages will be bumped as a patch. The one exception is when the dependency is a `peerDependency`, in which case the change will become a major.