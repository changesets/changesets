---
"@changesets/cli": patch
---

Detect already-published npm errors when the message isn't in `error.summary`. `handlePublishError` now also matches `error.detail` and the process output, so an `E403` whose JSON payload omits `summary` is skipped as already-published instead of failing the release.
