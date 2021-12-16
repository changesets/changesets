---
"@changesets/cli": minor
---

Added a new `.changeset/config.json` option: `fixed`. It can be used to group packages that should always be released together. If any package from a group is going to be released then all packages from that group will be released together (with the same version).

This is similar to what people often know from Lerna as this is how their fixed/locked mode works.
