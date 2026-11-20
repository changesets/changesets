---
"@changesets/git": patch
---

Speed up `getCommitsThatAddFiles` by not using `git log --follow`. On git 2.56 that flag turned a single changeset lookup into a scan of the whole parent tree, which is very slow in blobless clones and could stall `changeset version` in CI. We now find the commit that added a file with rename detection off and check for a rename only on that one commit, following the chain back when needed. The returned commit is the same as before.
