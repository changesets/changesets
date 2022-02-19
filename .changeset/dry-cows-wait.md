---
"@changesets/cli": minor
---

Refactored the publishing part of the code to invoke Yarn Berry instead of npm CLI for publishing purposes. This ensures that packages are correctly packed, so for instance workspace ranges can be correctly substituted now.
