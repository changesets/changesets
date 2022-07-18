---
"@changesets/cli": patch
"@changesets/config": patch
---

Snapshot feature is now stable 🥳 All config parameters are grouped under a single property called `snapshot`.

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
