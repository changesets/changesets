---
"@changesets/cli": patch
"@changesets/apply-release-plan": patch
---

Fixed an issue with dependency ranges still using pre-existing range modifiers instead of fixed package versions when performing a snapshot release. This ensures that installs of snapshot versions are always reproducible.
