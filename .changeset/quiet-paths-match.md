---
"@changesets/git": patch
---

Detect changed files with non-ASCII characters in their paths. Git quotes such paths by default (`core.quotePath`), so they never matched a package directory and `changeset status`/`changeset add` missed the package.
