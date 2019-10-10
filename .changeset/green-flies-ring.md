---
"@changesets/cli": major
"@changesets/assemble-release-plan": minor
---

Only bump peer dependents when the peer dependency is out of range.

If you want to restore the old behaviour, you should change your peerDependencies from using a caret(`^`) to a tilde(`~`)
