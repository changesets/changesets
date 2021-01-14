---
"@changesets/git": minor
---

Deprecate the `getCommitThatAddsFile` function. It's replaced with a bulk `getCommitsThatAddFiles` operation which will safely deepen a
shallow repo whilst processing multiple filenames simultaneously.
