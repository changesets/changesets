---
"@changesets/cli": minor
---

Commands supporting `--output` (such as `status` and `publish-plan`) can now be invoked with `CHANGESETS_OUTPUT=path/to/file` environment variable. This has the same effect as calling them with `--output=path/to/file`
