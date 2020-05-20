---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
---

Fix dependencies that were patch bumped not being updated in dependents package.json if they would leave semver range with `updateInternalDependencies` set to minor
