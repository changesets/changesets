---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add staged npm publishing with the `stagedPublishing` configuration option,
`publish --stage` and `--no-stage` overrides, and native npm, pnpm, and Yarn adapters.

Treat duplicate publishes and duplicate stages as finished only for the requested operation. After an ambiguous staging conflict, query fresh published metadata to reject staging a currently published version. Metadata lookup failures remain fatal.
