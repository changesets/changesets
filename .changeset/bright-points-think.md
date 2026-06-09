---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
---

Fixed resolution of changelog and commit generator modules so built-in modules can still be loaded when they are not installed in the target project.
