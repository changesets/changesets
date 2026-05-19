---
"@changesets/config": minor
---

Added support for `access: "internal"`, used by the GitHub NPM Packages Registries.

_Also added a warning if `access` is set to `internal` but `publishConfig.registry` does not point to GitHub's Registry._
