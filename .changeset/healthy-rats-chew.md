---
"@changesets/git": minor
---

`getChangedPackagesSinceRef` accepts now a new `changedFilePatterns` option. It can be used to determine which packages should be classified as changed. You can pass an array of glob patterns to it.
