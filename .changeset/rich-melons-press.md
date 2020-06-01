---
"@changesets/apply-release-plan": minor
"@changesets/assemble-release-plan": minor
"@changesets/cli": minor
---

Added support for ignoring packages in the `version` command. The version of ignored packages will not be bumped, but their dependencies will still be bumped normally. This is useful when you have private packages, e.g. packages under development. It allows you to make releases for the public packages without changing the version of your private packages. To use the feature, you can define the `ignore` array in the config file with the name of the packages:

```
{
  ...
  "ignore": ["pkg-a", "pkg-b"]
  ...
}
```

or you can pass the package names to the `--ignore` flag when using cli:
```
yarn changeset version --ignore pkg-a --ignore --pkg-b
```
