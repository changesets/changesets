---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
---

Fixed an issue with `*` dependency ranges not being replaced in premode. Those have to replaced with exact versions because prereleases don't satisfy wildcard ranges. A published prerelease package with such dependency range left untouched won't install correct prerelease dependency version.
