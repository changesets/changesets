---
"@changesets/assemble-release-plan": patch
---

Fixed an issue where exiting pre mode would give a patch bump to ignored packages that had a prerelease but were not depended on by any released package. Ignored packages are now correctly skipped in this scenario, consistent with how ignored dependents are already handled.
