---
"@changesets/changelog-git": patch
---

Fixed an issue with adding `[undefined]` to the generated changelog when the commit adding a changeset file could not be found. This could have happened when running `changeset add && changeset version` in a single command.
