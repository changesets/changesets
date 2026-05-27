---
"@changesets/types": major
---

Update the `opts` parameter for `CommitFunctions` and `ChangelogFunctions` to be `null | Record<string, unknown>` (stricter types) instead of `Record<string, unknown>` or `any`
