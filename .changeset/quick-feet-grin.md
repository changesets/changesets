---
"@changesets/cli": patch
---

Fixed an issue with `changeset status` executed without `since` argument. It should now correctly use the configured base branch as the default value.
