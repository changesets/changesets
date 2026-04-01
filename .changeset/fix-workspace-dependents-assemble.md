---
"@changesets/assemble-release-plan": patch
---

Fix dependent bump detection for workspace path references. Dependencies declared with specifiers like `workspace:packages/pkg` are now resolved correctly when deciding whether dependents need a release.
