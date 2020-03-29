---
"@changesets/apply-release-plan": patch
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
"@changesets/config": patch
"@changesets/get-dependents-graph": patch
"@changesets/get-release-plan": patch
"@changesets/git": patch
"@changesets/pre": patch
---

Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.
