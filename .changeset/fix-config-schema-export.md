---
"@changesets/config": patch
---

Export `schema.json` in the package's `exports` field to allow JSON schema validation in editors like VSCode while using `pnpm`. Users can reference the schema in their `.changeset/config.json` using `"$schema": "../node_modules/@changesets/config/schema.json"`.
