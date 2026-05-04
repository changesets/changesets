---
"@changesets/release-utils": major
---

Changed `runPublish()` signature.

Now requires passing separate `command` and `args` parameters:

```diff
runPublish({
-  script: `node -e 'console.log("test")'`
+  command: "node",
+  args: ["-e", `console.log("test")`]
  cwd: import.meta.dirname,
})
```
