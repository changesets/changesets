---
"@changesets/cli": patch
---

Packages are now published from cwd (usually the root of the repository) rather than from the package directories. This respects `.npmrc` files put in the root directory.
