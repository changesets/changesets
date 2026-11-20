---
"@changesets/cli": patch
---

`changeset version --ignore` now extends the `ignore` list from the config file instead of erroring when both are set, matching the CLI docs.
