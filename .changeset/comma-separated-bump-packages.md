---
"@changesets/cli": minor
---

Allow comma-separated package names in the `--major`, `--minor`, and `--patch` flags of the `add` command. For example, `--minor pkg-a,pkg-b` is now equivalent to `--minor pkg-a --minor pkg-b`.
