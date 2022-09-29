# Managing applications or non-npm packages

Changesets can also be used to manage application versions or non-npm packages (ie dotnet NuGet packages, ruby gems, docker images etc).

The only requirement is that the project has a package.json file to manage the versions and dependencies within the repo.

To enable this feature set `privatePackages` to `{ version: true, tag: true }` in your `.changesets/config.json` file. By default changesets will only update the changelog and version (ie `{ version: true, tag: false }`).

> **Note**
> Changesets only versions NPM package.json files, you can trigger releases for other package formats by creating workflows which trigger on tags/releases being created by changesets.

## Setting up a package

To enable a project to be tracked by changesets, it needs a minimal package.json with at least `name`, `private` and `version`.

```json
{
  "name": "my-project",
  "private": true,
  "version": "0.0.1"
}
```
