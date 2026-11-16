---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add staged npm publishing with the `stagedPublishing` configuration option,
`publish --stage` and `--no-stage` overrides, and native npm, pnpm, and Yarn adapters.

Treat duplicate publishes and duplicate stages as already done. The registry uses the same staging conflict message for pending stages and published versions, so this message is treated as already done in both cases. Publishing over a staged version and unrelated conflicts still fail.
