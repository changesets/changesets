# Catalogs

Catalogs let a workspace declare a version range once and reference it from any number of packages through the `catalog:` protocol:

```json [packages/app/package.json]
{
  "dependencies": {
    "react": "catalog:",
    "jest": "catalog:testing"
  }
}
```

Changesets understands catalogs out of the box. Where a range lives doesn't change how a release is calculated.

## Supported package managers

| Package manager | Where the catalogs live                                                     |
| --------------- | --------------------------------------------------------------------------- |
| pnpm            | `catalog` / `catalogs` in `pnpm-workspace.yaml`                             |
| Yarn            | `catalog` / `catalogs` in `.yarnrc.yml`                                     |
| Bun             | `catalog` / `catalogs` in `package.json`, at the root or under `workspaces` |

Both the default catalog (`catalog:`, also spelled `catalog:default`) and named catalogs (`catalog:testing`) are supported.

## Packages in your workspace

Use the [`workspace:` protocol](https://pnpm.io/workspaces#workspace-protocol) for packages that live in your workspace. A catalog can point at one anyway, which is occasionally useful to pin a single version of a package that is both published and consumed internally, and Changesets handles it: the reference is resolved before deciding what to release, so the dependent is bumped exactly as it would be with the range written out in full.

Releasing a package that a catalog points at updates the catalog entry, keeping the range style it had. Giving `@scope/pkg` a major release turns this:

```yaml [pnpm-workspace.yaml]
catalog:
  "@scope/pkg": ^1.0.0
```

into this:

```yaml [pnpm-workspace.yaml]
catalog:
  "@scope/pkg": ^2.0.0
```

The packages referencing it keep saying `catalog:`, only the catalog changes. Entries that no package in the workspace references are left alone.

## Dependencies outside your workspace

Editing a dependency range in a package's own `package.json` marks that package as changed, because the file lives inside the package. A catalog lives at the root of the workspace and belongs to no package in particular, so Changesets treats an updated catalog entry as a change to every package referencing it.

That means `changeset add` picks those packages up, and a pull request from a dependency update bot that only touches the catalog still asks for a changeset.

Set [`detectCatalogChanges`](./config.md#detectcatalogchanges) to `false` to opt out:

```json [.changeset/config.json]
{
  "detectCatalogChanges": false
}
```
