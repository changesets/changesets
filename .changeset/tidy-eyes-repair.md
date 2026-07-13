---
"@changesets/cli": patch
---

Fixed already-published version detection with npm 12. npm 12 wraps all successful `npm info --json` output in an array and reports zero-match queries as an E404 "No match found for version" error instead of empty stdout, which made `changeset publish` treat every package as unpublished and fail attempting to republish existing versions.
