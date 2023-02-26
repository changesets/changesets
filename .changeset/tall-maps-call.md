---
"@changesets/cli": patch
---

Reduce the default amount of concurrent requests sent to `npm`. This should address unexpected 403 issues on large monorepos.
