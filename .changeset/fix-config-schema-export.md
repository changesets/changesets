---
"@changesets/config": patch
---

Export `schema.json` in the package's `exports` field. Package managers with strict module resolution like `pnpm` respect the `exports` field, which previously made the schema file inaccessible. Users can now reference the schema in their `.changeset/config.json` using `"$schema": "../node_modules/@changesets/config/schema.json"`.
