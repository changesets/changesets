---
"@changesets/apply-release-plan": patch
---

Fix workspace protocol dependency updates for explicit ranges, aliases, and path references. Valid `workspace:` dependency forms are now preserved and only rewritten when the referenced release leaves the supported range or path.
