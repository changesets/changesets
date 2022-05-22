# Managing applications or non-npm packages

Changesets can also be used to manage application versions or non-npm packages (ie dotnet NuGet packages, ruby gems, docker images etc).

The only requirement is that the project has a package.json file to manage the versions and dependencies within the repo.

To enable this feature set `enablePrivatePackageTracking` to `true` in your `.changesets/config.json` file.

> **Note**
> Changesets only versions NPM package.json files, you can trigger releases for other package formats by creating workflows which trigger on tags/releases being created by changesets.

> **Note**
> This feature relies on git tags to track releases, ensure you fetch tags before you publish.

## Setting up a package

To enable a project to be tracked by changesets, it needs a minimal package.json with at least `name`, `private` and `version`.

```json
{
  "name": "my-project",
  "private": true,
  "version": "0.0.1"
}
```
