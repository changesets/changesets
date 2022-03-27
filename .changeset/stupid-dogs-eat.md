---
"@changesets/cli": minor
---

Allow `"commit"` option to be more configurable. You can now point to a module (using a module name or a relative path) that might contain `getAddMessage` and/or `getVersionMessage`. This allows you to configure how the commit message is generated, if `[skip ci]` gets included, etc.
