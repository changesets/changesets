---
"@changesets/apply-release-plan": major
"@changesets/config": major
"@changesets/types": major
"@changesets/cli": major
"@changesets/write": minor
---

Changesets no longer depends on Prettier and instead now uses [formatly](https://github.com/JoshuaKGoldberg/formatly) to automatically detect the formatter used in your project to format the written changesets and changelogs.

A new `format` option can be configured in `.changeset/config.json` to explicitly set the formatter used. Supported formatters include `"prettier"`, `"biome"`, `"deno"`, and `"dprint"`. The default value of `"auto"` will detect the formatter based on your project configuration files. Set `false` to disable formatting altogether.

As such, the `prettier` option (added in `@changesets/cli` v2.28.0) has also been removed in favor of the `format` option. To migrate, if you have set `prettier: false`, set `format: false` instead or remove it altogether as Changesets is able to re-use your installed formatter.
