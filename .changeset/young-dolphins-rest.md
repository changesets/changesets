---
"@changesets/assemble-release-plan": patch
---

Fixed an issue with the `assembleReleasePlan`'s signature not being compatible with the old shape of the `config` and `snapshot` parameters. This could have caused runtime errors during snapshot releases when only some of the Changesets transitive dependencies were updated without other ones.
