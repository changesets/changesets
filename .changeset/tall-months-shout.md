---
"@changesets/cli": minor
---

Add `--type` flag to the `add` command

The `add` command now supports a `--type` flag that provides the semver bump type (`patch`, `minor` or `major`) from the command line instead of prompting for it. The bump type is applied to all packages that have changed since the base branch (or the ref provided with `--since`).

When combined with `--message`, the changeset is created without any prompts, which makes it possible to add changesets from scripts and other automation:

```sh
changeset add --type patch --message 'Fix crash on startup'
```
