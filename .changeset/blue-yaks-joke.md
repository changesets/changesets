---
"@changesets/assemble-release-plan": patch
---

Fixed an issue with bumping a peer dependency using a `"none"` changeset type resulting in the dependant package being major bumped.
