---
"@changesets/apply-release-plan": patch
---

List `optionalDependencies` in the "Updated dependencies" changelog entry.

`changeset version` rewrites the range of an optional dependency and releases the
dependent package, but `getChangelogEntry` only looked at `dependencies` and
`peerDependencies`, so such releases were documented as "No changes in this release."
