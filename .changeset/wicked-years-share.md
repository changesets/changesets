---
"@changesets/cli": minor
---

A new config-level `changedFilePatterns` option has been added. You can configure it with an array of glob patterns like here:

```json
// .changeset/config.json
{
  "changedFilePatterns": ["src/**"]
}
```

Files that do not match the configured pattern won't contribute to the "changed" status of the package to which they belong. This both affects `changesets add` and `changeset status`.
