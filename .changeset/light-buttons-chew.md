---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": major
---

A new `updateInternalDependents` experimental option has been added. It can be used to add dependent packages to the release (if they are not already a part of it) with patch bumps. To use it you can add this to your config:

```json
{
  "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
    "updateInternalDependents": "always"
  }
}
```

This option accepts two values - `"always"` and `"out-of-range"` (the latter matches the current default behavior).
