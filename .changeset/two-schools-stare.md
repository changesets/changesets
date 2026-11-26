---
"@changesets/cli": minor
---

Added `--allow-no-changes` to the `status` and `version` commands, which makes them exit with code 0 if no changesets are found.

_This should make them behave how they did in v2._
