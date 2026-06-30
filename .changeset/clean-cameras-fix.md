---
"@changesets/config": major
"@changesets/types": major
---

Replaced the `prettier` config option with `format`. `format` supports `"auto"`, `"prettier"`, `"oxfmt"`, `"deno"`, `"dprint"`, and `false`. If you previously used `prettier: false`, migrate to `format: false`.
