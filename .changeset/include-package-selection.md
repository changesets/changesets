---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add an `include` configuration option and a `changeset version --include` flag to select packages while treating all other packages as ignored. Preserve excluded changesets and reject mixed included/excluded changesets without partial consumption.
