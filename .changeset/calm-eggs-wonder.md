---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fixed an issue with `"none"` releases causing package versions being bumped during snapshot releases. This issue was making ignored packages to being bumped incorrectly under such circumstances.
