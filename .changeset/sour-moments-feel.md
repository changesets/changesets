---
"@changesets/cli": minor
---

Add Bun support for publishing packages. When a project uses Bun as its package manager (detected via `bun.lockb` or `packageManager` field), changesets will now use `bun publish` instead of `npm publish`.
