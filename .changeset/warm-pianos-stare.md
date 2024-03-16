---
"@changesets/read": patch
---

Fix the case of running `changesets status --since` when the `.changesets` directory is in a subdirectory of the repository. As a side-effect, it should now be more portable to Windows.
