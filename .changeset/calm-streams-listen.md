---
"@changesets/cli": patch
---

Fix `changeset publish --output` and `changeset tag --output` crashing the process with an unhandled `error` event when the output path can't be opened (for example a directory or an unwritable location). The failure is now reported as a normal error before anything is published.
