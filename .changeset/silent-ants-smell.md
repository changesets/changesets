---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

author: @Andarist
author: @BPScott

Fixed the issue that caused transitive dependents of dev dependents to be bumped when a package got bumped. To illustrate this with an example:

```
pkg-a - version: 1.0.0
pkg-b - devDependencies['pkg-a']: 1.0.0
pkg-c - dependencies['pkg-b']: 1.0.0
```

With a changeset for `pkg-a` the `pkg-c` could have been sometimes incorrectly released.
