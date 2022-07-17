---
"@changesets/cli": patch
"@changesets/config": patch
---

**NOTE: BREAKING CHANGE**

Group snapshot config parameters under a single property called `snapshot`.

To migrate, make sure to update your `config.json`.

Old usage:

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
  "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
    "snapshot": {
      "useCalculatedVersion": true
    }
  }
}
```
