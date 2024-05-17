---
"@changesets/cli": patch
---

Fixed an issue with `changeset status` incorrectly returning an error status in two cases:

- for changed ignored packages
- for changed private packages when `privatePackage.version` was set to `false`
