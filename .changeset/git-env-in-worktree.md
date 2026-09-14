---
"@changesets/git": patch
---

Drop the inherited git environment variables, such as `GIT_DIR`, when running git commands, so that the repository is always resolved from the given `cwd`. This fixes `status --since=<ref>` reporting that no changesets were found when it runs from a git hook inside a `git worktree`.
