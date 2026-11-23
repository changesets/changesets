---
"@changesets/cli": patch
"@changesets/git": patch
---

Fixed `remoteTagExists` matching the end instead of full names.

e.g. `shacl-playground` would also match `@zazuko/shacl-playground`, which it shouldn't.
