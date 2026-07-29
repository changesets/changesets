# Beyond npm

When using Changesets, you are not limited to only publishing to npm. Changesets can also be used to manage private packages such as applications or non-npm packages (i.e. dotnet NuGet packages, ruby gems, docker images, etc).

The only requirement is that the project has a `package.json` file to manage the versions and dependencies within the repo. It should have at least `name`, `private` and `version` set:

```json [packages/my-project/package.json]
{
  "name": "my-project",
  "private": true,
  "version": "0.0.1"
}
```

And set [`privatePackages.version`](./config.md#privatepackages-version) to `true` in your `.changesets/config.json` file to enable versioning for these private packages. The packages can also be tagged during `changeset publish` by setting [`privatePackages.tag`](./config.md#privatepackages-tag) to `true`.

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
