---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fix a bug with prereleases where a package would not be bumped with the highest bump type of all changesets from previous prereleases within the same prerelease run
