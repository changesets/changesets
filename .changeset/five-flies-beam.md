---
"@changesets/apply-release-plan": minor
---

Support importing custom `changelog` option ES module. Previously, it used `require()` which only worked for CJS modules, however now it uses `import()` which supports both CJS and ES modules.
