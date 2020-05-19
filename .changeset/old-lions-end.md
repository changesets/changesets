---
"@changesets/assemble-release-plan": minor
"@changesets/types": minor
---

Add optional `dependenciesLeavingRange` field to release object that contains a list dependencies of the released package have been updated to maintain semver compatibility.
This is useful for identifying dependencies that _must_ be updated regardless of what internal dependency range bumping strategy used when applying the release plan.
