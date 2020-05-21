---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
---

Fix patch bumped dependencies not being updated in dependents package.json when leaving semver range with `updateInternalDependencies` set to minor.
