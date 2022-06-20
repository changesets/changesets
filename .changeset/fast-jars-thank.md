---
"@changesets/cli": minor
---

Private packages can now be tagged in the same way public packages do when they are published to npm. 

To enable set `privatePackages: 'version-and-tag'` in your config.json.

You can also now opt private packages out of versioning entirely by setting `privatePackages: 'ignore'`.