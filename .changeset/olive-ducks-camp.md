---
"@changesets/cli": patch
"@changesets/config": patch
---

A possibility to use the calculated version for snapshot releases is now stable 🥳 All snapshot-related config parameters are now grouped under a single config property called `snapshot`.

To migrate, make sure to update your `config.json`.

Old usage (still works, but comes with a deprecated warning):

```json
{
  "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
    "useCalculatedVersionForSnapshots": true
  }
}
```

New usage:

```json
{
  "snapshot": {
    "useCalculatedVersion": true
  }
}
```
