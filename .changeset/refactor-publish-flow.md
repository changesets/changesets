---
"@changesets/cli": minor
---

Improved `changeset publish` failure handling. Errors are reported per package, successful publishes are still tagged when another package fails, and authentication retries avoid republishing completed packages.
