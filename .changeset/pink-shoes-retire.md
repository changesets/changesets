---
"@changesets/cli": minor
---

Add new config option 'updateInternalDependencies' that can be set to 'minor' to only update internal dependencies in the same release if the dependency was minor released or above. Defaults to 'patch' which is the existing behaviour.
