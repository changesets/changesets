---
"@changesets/cli": patch
---

Improved compatibility with npm 7+ since they've started to print errors to the `stderr` (where previously they were printed to `stdout`) when using `npm publish --json`.
