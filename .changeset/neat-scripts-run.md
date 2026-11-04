---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

`changeset version` now runs the `preversion` and `postversion` scripts of the packages it versions. Set the new `runVersionScripts` config option to `false` to opt out.
