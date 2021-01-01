---
"@changesets/git": minor
---

Automatically deepen shallow clones in order to determine the correct commit at
which changelogs were found.

Deprecate the `getCommitThatAddsFile` function; it's replaced with
a bulk `getCommitsThatAddFiles` operation which will safely deepen a
shallow repo whilst processing multiple filenames simultaneously.
