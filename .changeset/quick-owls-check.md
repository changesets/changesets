---
"@changesets/cli": minor
---

Added a `changeset check` command that validates every changeset in `.changeset/` is well-formed and only references packages that still exist in the workspace. Useful in CI to catch malformed or stale changesets (e.g. from AI-generated content or deleted packages) before they break `changeset version` during a release.
