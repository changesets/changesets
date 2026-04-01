---
"@changesets/cli": patch
---

Fix several `changeset version` issues with workspace protocol dependencies. Valid explicit `workspace:` ranges and aliases are no longer rewritten unnecessarily, and workspace path references are handled correctly during versioning.
