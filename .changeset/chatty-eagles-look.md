---
"@changesets/apply-release-plan": none
"@changesets/assemble-release-plan": patch
---

Fixed an issue with including dependents in the release plan for dependencies using `workspace:` protocol that had a `none` changeset for them.
