---
"@changesets/cli": minor
---

`changeset add --major`, `--minor` and `--patch` now accept no package list, bumping the packages detected as changed instead. Packages named on another release type option are left out of that set, so `--major pkg-a --patch` majors `pkg-a` and patches every other changed package.
