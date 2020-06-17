---
"@changesets/cli": minor
---

Changed condition based on which single-package repositories are identified when creating tags after successful publish. It is now based on whether we have recognized the repository to be managed by monorepo tooling or not.
