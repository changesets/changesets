---
"@changesets/assemble-release-plan": patch
---

When both a dev dep and a prod dep of a dependent package are published, the version of the dependent package should be bumped. This fixes a regression introduced by #313.
