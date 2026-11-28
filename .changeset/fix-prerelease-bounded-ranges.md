---
"@changesets/apply-release-plan": patch
---

Fix updating bounded dependency ranges (such as `>=1.0.0 <2.0.0`) during prereleases so the upper bound increments from the base release version rather than stripping the prerelease suffix.
