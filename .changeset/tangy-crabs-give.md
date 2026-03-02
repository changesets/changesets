---
"@changesets/cli": minor
---

Add a `--message` (`-m`) flag to `changeset add` (and default `changeset`) so the changeset summary can be provided from the command line. When `--message` is present, the summary prompt is skipped while the final confirmation step is kept.
