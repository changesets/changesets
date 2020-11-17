---
"@changesets/cli": patch
---

Gracefully handle 403 errors when publishing.

Sometimes NPM returns an error in case a version is already published, causing the publish script to fail and preventing changeset to finish the job. In this case, we should ignore the error.
