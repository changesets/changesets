---
"@changesets/cli": patch
---

Gracefully handle stale `npm info` data leading to duplicate publish attempts: E403 "cannot publish over" errors are now detected and treated as a successful publish rather than a failure.
