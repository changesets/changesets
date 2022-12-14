---
"@changesets/git": major
---

`getCommitsThatAddFiles` accepts an options object argument now where you can use `cwd` option.

```diff
-getCommitsThatAddFiles(paths, cwd);
+getCommitsThatAddFiles(paths, { cwd });
```
