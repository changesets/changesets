---
"@changesets/apply-release-plan": major
---

Generated changelog entries and rewritten `package.json` files are now formatted with [@changesets/format](https://github.com/changesets/format) instead of depending on Prettier directly. Formatter selection can be auto-detected from the project configuration or controlled via the `format` config option.
