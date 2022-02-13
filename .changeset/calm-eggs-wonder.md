---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fixed an issue with `"none"` releases causing package versions being bumped during snapshot releases. In addition to when you create `"none"` release types explicitly Changesets might create them implicitly in some situations, for example under some circumstances this issue caused snapshot releases to be created sometimes for ignored packages.
