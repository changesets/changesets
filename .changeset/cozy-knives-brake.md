---
"@changesets/types": major
---

Use stricter types for the options parameter for `CommitFunctions`, `ChangelogFunctions`, `Config` & `WrittenConfig`'s `commit` and `changelog` properties, to `Record<string, unknown>` (and may be nullable) instead of `any` or `Record<string, any>`
