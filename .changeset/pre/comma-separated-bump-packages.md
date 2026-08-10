---
"@changesets/cli": minor
---

Allow comma-separated values in array-valued CLI flags: the `--major`, `--minor`, and `--patch` flags of the `add` command, and the `--ignore` flag of the `version` command. For example, `--minor pkg-a,pkg-b` is now equivalent to `--minor pkg-a --minor pkg-b`. Surrounding whitespace is trimmed and empty entries are ignored.
