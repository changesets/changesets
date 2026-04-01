---
"@changesets/get-dependents-graph": patch
---

Fix dependency graph validation for workspace path references. Valid `workspace:packages/pkg` specifiers are now treated as local dependencies instead of being rejected as invalid ranges.
