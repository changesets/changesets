---
"@changesets/cli": patch
---

For pnpm projects, Changesets now match pnpm's native registry behavior more closely during unpublished package checks. Both scope-based `publishConfig` registry overrides and `publishConfig.registry` are now ignored.
