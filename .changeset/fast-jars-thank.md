---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Private packages can now be tagged in the same way public packages do when they are published to npm.

To enable set `privatePackages: { version: true, tag: true }` in your config.json.

You can also now opt private packages out of versioning entirely by setting `privatePackages: false`.
