---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fixed an infinite loop involving a fixed group of packages and a package within that group that was both ignored and dependent on another package from that group.
