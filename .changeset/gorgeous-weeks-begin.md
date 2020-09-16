---
"@changesets/assemble-release-plan": major
---

Returned releases in pre mode will have type of the highest bump type within the current release now, instead of having the highest bump type from among all changesets within this pre mode. So if you release a new prerelease including a major bump and later release the same package with a minor bump the assembled release will be of type minor - the final computed version will, of course, still be the next one for a major bump.
