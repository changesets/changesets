---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fixed a bug where only the unreleased pre-release changesets were taken into account when calculating the new version, not previously released changesets.
