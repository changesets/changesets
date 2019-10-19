---
"@changesets/cli": patch
---

Close off error when running publish where individual packages have pre or post hooks.

Under the previous behaviour, JSON parsing the response to publish failed, causing git tags to not be created.