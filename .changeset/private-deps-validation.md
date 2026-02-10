---
"@changesets/cli": patch
"@changesets/config": patch
---

Allow versioned private packages to depend on skipped packages without requiring them to also be skipped. Private packages are not published to npm, so it is safe for them to have dependencies on ignored or unversioned packages.
