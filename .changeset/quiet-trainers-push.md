---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
---

Fixed an issue that caused **created** CHANGELOG files not being formatted in the same way as the **updated** ones (this could happen when calling `changeset version` for the very first time for a package).
