---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add staged npm publishing with the `stagedPublishing` configuration option,
`publish --stage` and `--no-stage` overrides, and native npm, pnpm, and Yarn adapters.

Treat an already-staged version as finished when the registry rejects duplicate staging, just like an already-published version.
