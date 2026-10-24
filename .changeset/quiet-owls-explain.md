---
"@changesets/cli": patch
---

`changeset add` now explains why a package passed to `--major`, `--minor` or `--patch` can't be used when it exists but is skipped (private with `privatePackages.version` not enabled, listed in `ignore`, or missing a `version` field), instead of saying it is not found and may be misspelled.
