---
"@changesets/cli": minor
---

Added a `changeset pack` command that requires `--out-dir` and writes publishable package tarballs plus an enriched `publish-plan.json` into that directory, either from the current workspace or from a saved publish plan via `--from-plan`.
