---
"@changesets/cli": minor
"@changesets/types": patch
---

Add Bun as a supported package manager for packing and publishing packages.

Requires Bun 1.3.1 or newer. Refresh Bun's lockfile after versioning with `bun install --lockfile-only --ignore-scripts` before packing or publishing so workspace dependencies use the current versions.
