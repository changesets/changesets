---
"@changesets/git": patch
---

`getChangedFilesSince` and `getChangedPackagesSinceRef` will now return the correct absolute paths of the changed files when the passed `cwd` is different from the repository's root.
