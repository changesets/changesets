---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
---

Fixed semver ranges (such as `>=1.0.0 <2.0.0`) getting cut off (`>=2.0.0`) when updating internal dependencies.
