---
"@changesets/git": minor
---

Removed `getChangedPackagesSinceMaster` and `getChangedChangesetFilesSinceMaster` and replace them with `getChangedPackagesSinceRef` and `getChangedChangesetFilesSinceRef`. The new methods along with `getChangedFilesSince` also now require arguments as an object with `cwd` and `ref` properties to avoid accidentially passing `cwd` as `ref` and vice versa
