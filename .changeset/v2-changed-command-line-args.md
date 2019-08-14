---
"@changesets/cli": major
---

#### Changed command line argument names

To align command line argument names with the new config, we have updated some
of their names.

- `updateChangelog` option has been removed in favor of `changelog`
  - `changelog` options accepts a path which we will use to resolve your `getChangelogEntry` function.
- `isPublic` flag has been changed to `access` and accepts `public` or `private`
- Removed `skipCI` - the `commit` option now automatically skips CI.
