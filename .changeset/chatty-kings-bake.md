---
"@changesets/release-utils": major
---

Removed `execWithOutput` and `spawnWithOutput`.

They were never intended to be used externally, but are now removed either way.

If you used them, we recommend using `tinyexec` or `node:child_process#exec` directly.
