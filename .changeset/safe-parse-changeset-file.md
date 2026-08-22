---
"@changesets/parse": minor
---

Add `safeParseChangesetFile`, a non-throwing twin of `parseChangesetFile` that returns `{ ok: true, changeset }` for valid contents and `{ ok: false, error }` (with the exact message the throwing form produces) for invalid ones.
