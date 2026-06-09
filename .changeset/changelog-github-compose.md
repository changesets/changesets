---
"@changesets/changelog-github": major
---

Add `composeReleaseLine` and remove the `disableThanks` option.

Point `changelog` at a small local module and compose each changelog line in JS from `summary`, `pr`, `commit`, `authors[]`, and the `linkRefs`/`linkHints` helpers, with an optional `separator` override (e.g. for compact output). Default output is unchanged.

Migration: replace `disableThanks: true` with a `composeReleaseLine` callback that omits the `Thanks ...!` segment. See `docs/config-file-options.md`.
