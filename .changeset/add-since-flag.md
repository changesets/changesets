---
"@changesets/cli": minor
---

Add `--since` flag to `add` command

The `add` command now supports a `--since` flag that allows you to specify which branch, tag, or git ref to use when detecting changed packages. This is useful for gitflow workflows where you have multiple target branches and the `baseBranch` config option doesn't cover all use cases.

Example: `changeset add --since=develop`

If not provided, the command falls back to the `baseBranch` value in your `.changeset/config.json`.
