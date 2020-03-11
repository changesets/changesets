---
"@changesets/git": major
---

Use `@manypkg/get-packages` instead of `get-workspaces` in `getChangedPackagesSinceRef`. This means `getChangedPackagesSinceRef` now returns `Promise<Package[]>`(where `Package` is from `@manypkg/get-packages`) rather than `Promise<Workspace[]>`(where `Workspace` is from `get-workspaces`). The notable change is that `config` was renamed to `packageJson` and the package objects don't have a `name` field(use `packageJson.name` instead).
