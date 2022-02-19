---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Versioning a package without a `package.json#version` will no longer result in `null` being generated as the new version of a package (or as part of it when dealing with pre mode of snapshot releases). Instead we'll generate the minimal version - e.g. for a minor bump the `0.1.0` version will be generated.
