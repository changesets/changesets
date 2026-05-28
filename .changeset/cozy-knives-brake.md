---
"@changesets/types": major
---

Use stricter types for the options parameter for `CommitFunctions`, `ChangelogFunctions`, `Config` & `WrittenConfig`'s `commit` and `changelog` properties, to `null | Record<string, unknown>` instead of `any` or `Record<string, any>`
