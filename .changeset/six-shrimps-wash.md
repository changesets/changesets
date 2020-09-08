---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fixed an issue with dependant packages not being updated to their highest bump type in pre mode sometimes. This could happen when dependant packages were only versioned because of their dependencies being upgraded and not because of a dedicated changeset for those dependant packages.

For the very same reason linked packages were also not always bumped correctly in pre mode to the highest bump type in a linked group.
