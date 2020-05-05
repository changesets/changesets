---
"@changesets/git": patch
---

Previously monorepo package may be considered as changed package instead of actually changed one. Now git package is looking for the longest package.dir path that satisfies condition
