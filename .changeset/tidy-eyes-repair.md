---
"@changesets/cli": patch
---

Fixed already-published version detection with npm 12, which always wraps successful `npm info --json` output in an array. The unwrapped output made `changeset publish` treat every package as unpublished and fail attempting to republish existing versions.
