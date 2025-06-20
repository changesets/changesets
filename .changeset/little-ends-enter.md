---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

Fixed an issue with `workspace:^` and `workspace:~` dependency ranges not being semantically treated as, respectively, `^CURRENT_VERSION` and `~CURRENT_VERSION`. This led to dependent packages being, at times, bumped too often when their dependencies with those ranges were bumped.
