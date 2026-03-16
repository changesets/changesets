---
"@changesets/cli": minor
---

Add non-interactive mode for `changeset add` and new `changeset changed` command, enabling AI agents, CI pipelines, and automation scripts to create changesets without interactive prompts.

New flags for `changeset add`: `--packages` (`-p`) to specify packages with optional inline bump type (e.g. `pkg:minor`), `--type` (`-t`) for a default bump type, and `--all` to auto-select all git-changed packages. Non-interactive mode activates when `--packages` (or `--all`) and `--message` are both provided.

New command `changeset changed` lists packages changed since the base branch, with `--json` for machine-readable output and `--since` for custom git refs.
