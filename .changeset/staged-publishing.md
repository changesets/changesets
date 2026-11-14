---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add staged npm publishing, including config and CLI overrides, native npm,
pnpm, and Yarn adapters, structured stage events, and
bulk approve/reject commands.

Treat duplicate publishes and duplicate stages as finished only for the requested operation. After an ambiguous staging conflict, query fresh published metadata to reject staging a currently published version. Metadata lookup failures remain fatal.
