---
"@changesets/apply-release-plan": minor
"@changesets/assemble-release-plan": minor
"@changesets/catalogs": minor
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/get-dependents-graph": minor
"@changesets/get-release-plan": minor
"@changesets/git": minor
"@changesets/types": minor
---

Add support for dependency catalogs.

Ranges declared through the `catalog:` protocol are now resolved wherever Changesets looks at a dependency range, so a package depending on another one in the workspace through a catalog is released exactly as it would be with the range written out in full. Releasing a package a catalog points at updates the catalog entry itself, keeping its range style, while the packages referencing it keep saying `catalog:`. Both the default catalog and named catalogs are supported, in pnpm (`pnpm-workspace.yaml`), Yarn (`.yarnrc.yml`) and Bun (`package.json`) workspaces.

Editing a dependency range in a package's own `package.json` marks that package as changed. A catalog belongs to no package in particular, so `changeset add` and `changeset status` treat an updated catalog entry as a change to every package referencing it. Set the new `detectCatalogChanges` config option to `false` to opt out.
