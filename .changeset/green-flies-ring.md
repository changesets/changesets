---
"@changesets/cli": major
"@changesets/assemble-release-plan": minor
---

Only bump dependents which depend on the given dependency as a peerDependency

If you want to restore the old behaviour, you should change your peerDependencies from using a caret(`^`) to a tilde(`~`)
