# Private Packages

Changesets can be used to manage private packages such as applications or non-npm packages (i.e. dotnet NuGet packages, ruby gems, docker images, etc).

The only requirement is that the project has a `package.json` file to manage the versions and dependencies within the repo. It should have at least `name`, `private` and `version` set:

```json
{
  "name": "my-project",
  "private": true,
  "version": "0.0.1"
}
```

By default, changesets can be added for private packages and be versioned as a normal package. Private packages can also be tagged by setting [`privatePackages.tag`](./config.md#privatepackagestag) to `true` in your `.changeset/config.json` file.

## Private Dependencies

Private packages can depend on other private packages that are ignored by the [`ignore`](./config.md#ignore) option. Since they aren't published to npm, it is safe for them to depend on ignored packages.

For example, if you have an app `A` that depends on a private library `B`, you can ignore `B` while still versioning `A`:

```json
{
  "ignore": ["B"]
}
```

This works because `A` is private and will never be published to npm with a stale reference to `B`.

## Automated Releases

If [`privatePackages.tag`](./config.md#privatepackagestag) is enabled, you can also automate releases for private packages by following the [Automating Changesets](./automating.md) guide.

When calling `changeset publish` from the GitHub Action, it will create the git tags and GitHub releases for the private packages. They will not be published to npm.

You can also create custom workflows that trigger on tags/releases being created to publish the private packages to other environments.
