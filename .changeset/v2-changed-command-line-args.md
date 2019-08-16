---
"@changesets/cli": major
---

#### Changed command line argument names

We have removed command line arguments that overrwrite the config. The following commands can no longer
be passed in:

- `updateChangelog`
- `isPublic`
- `skipCI`
- `commit`

This has been done to avoid overloading the number of ways you can pass options, as within any single
repository, there should be a single consistent way in which these values are always provided.
