---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add staged npm publishing with the `stagedPublishing` configuration option,
`publish --stage` and `--no-stage` overrides, and native npm, pnpm, and Yarn adapters.

Treat duplicate publishes and duplicate stages as already done. After an ambiguous staging conflict, reuse the package manager’s existing info query to reject staging an already published version. Lookup errors, publishing over a staged version, and unrelated conflicts still fail. The info query retains its normal registry and cache behavior.
