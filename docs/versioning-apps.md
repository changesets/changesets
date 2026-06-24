# Managing applications or non-npm packages

Changesets can also be used to manage application versions or non-npm packages (ie dotnet NuGet packages, ruby gems, docker images etc).

The only requirement is that the project has a `package.json` file with package metadata so Changesets can discover the package and calculate release plans.

To enable this feature set `privatePackages` to `{ version: true, tag: true }` in your `.changesets/config.json` file. By default changesets will only update the changelog and version (ie `{ version: true, tag: false }`).

> **Note**
> Changesets currently uses package metadata from `package.json` for package discovery. Version providers control where the current version is read from and which files are written when versions are applied. You should trigger non-npm publishes with your own workflows.

## Ruby gems

For Ruby gems, you can use the Ruby version provider to update common Ruby version files.

If your gem has conventional file names, the default automatic provider selection will use the Ruby provider when it detects Ruby version files:

```json
{
  "privatePackages": { "version": true, "tag": true }
}
```

The Ruby provider reads the current version from Ruby files and updates:

- `lib/<gem-name>/version.rb` or a single discovered `lib/**/version.rb`
- `<gem-name>.gemspec` or a single discovered root `*.gemspec`
- `Gemfile.lock`, converting prereleases such as `2.0.0-beta.1` to Bundler's `2.0.0.pre.beta.1` lockfile format

For non-standard file names, configure package-specific paths:

```json
{
  "privatePackages": { "version": true, "tag": true },
  "versionProvider": {
    "packages": {
      "my-gem": {
        "type": "ruby",
        "gemName": "my-gem",
        "versionFile": "lib/my_gem/version.rb",
        "gemspec": "my-gem.gemspec",
        "gemfileLock": "Gemfile.lock"
      }
    }
  }
}
```

Set `versionFile`, `gemspec`, or `gemfileLock` to `false` to skip that file. Publishing to RubyGems should still be handled by your own release workflow.

## Setting up a package

To enable a project to be tracked by changesets, it needs a minimal package.json with at least `name`, `private` and `version`.

```json
{
  "name": "my-project",
  "private": true,
  "version": "0.0.1"
}
```

## Private dependencies

When a versioned private package (app) depends on another private package that is skipped (either via the `ignore` option or `privatePackages.version: false`), changesets will not require the app to also be skipped. Since private packages are not published to npm, it is safe for them to depend on skipped packages.

For example, if you have an app `A` that depends on a private library `B`, you can ignore `B` while still versioning `A`:

```json
{
  "ignore": ["B"]
}
```

This works because `A` is private and will never be published to npm with a stale reference to `B`.
