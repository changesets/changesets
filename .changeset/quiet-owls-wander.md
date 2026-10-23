---
"@changesets/cli": patch
---

Fixed `changeset version` failing with "There is no .changeset directory in this project" when run from a subdirectory of the project. Changesets, the prerelease state and the commit module are now read from the project root, like in the other commands.
