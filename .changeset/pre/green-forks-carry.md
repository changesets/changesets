---
"@changesets/cli": major
---

The `prettier` option in `.changeset/config.json` has been removed in favor of `format`. `format` supports `"auto"`, `"prettier"`, `"oxfmt"`, `"deno"`, and `"dprint"`, and `false` disables formatting. If you previously used `prettier: false`, migrate to `format: false` or remove the option to use automatic formatter detection.
