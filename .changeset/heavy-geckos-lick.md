---
"@changesets/apply-release-plan": patch
"@changesets/write": patch
---

Improved compatibility with the alpha releases of Prettier v3 by awaiting the `.format` result since it's a promise in that version.
