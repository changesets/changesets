---
"@changesets/cli": patch
---

Use pnpm inside a pnpm workspace. Previously, pnpm was detected properly only in projects that use one lockfile per project. However, by default pnpm creates a single lockfile per workspace.
