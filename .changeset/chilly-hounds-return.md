---
"@changesets/cli": patch
---

Fixed an internal issue that prevented `npm publish --json`'s output to be handled properly. This makes sure that unrelated JSONs printed by lifecycle scripts don't interfere with our logic.
