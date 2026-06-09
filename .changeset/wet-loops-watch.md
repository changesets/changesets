---
"@changesets/cli": major
---

Migrated from `enquirer` + `@inquirer/launch-editor` to `@clack/prompts` + `launch-editor`.

This means the CLI flows will have minor changes, but they are largely the same.

This change also fixes various issues related to `enquirer` like cancelling prompts crashing the CLI.
