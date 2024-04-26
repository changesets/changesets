---
"@changesets/cli": patch
---

Add failOnNoChanges flag to the changeset status command in the cli. This flag will still force an exit code 1 even if no uncommitted changes exist in one of your packages. The existing behavior will still be the default.
