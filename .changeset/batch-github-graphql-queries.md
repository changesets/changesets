---
"@changesets/get-github-info": minor
"@changesets/changelog-github": minor
---

Batch GitHub GraphQL API requests to avoid "Timeout on validation of query" errors when there are many changesets. Also fixes DataLoader cache deduplication (was broken due to object reference equality) which caused redundant API lookups. Batch size defaults to 100 and is configurable via the `batchSize` config option or `CHANGESET_GITHUB_BATCH_SIZE` env var.
