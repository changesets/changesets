---
"@changesets/cli": patch
"@changesets/git": patch
---

Fixed `remoteTagExists` matching tag names by suffix, so a package whose tag happens to be the tail of another package's tag (a scoped package such as `@zazuko/shacl-playground@2.0.0` and an unscoped one named `shacl-playground`) had its release skipped as if it was already tagged on the remote.
