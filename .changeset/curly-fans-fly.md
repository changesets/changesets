---
"@changesets/cli": patch
---

Call `pnpm publish` directly from the directory of the published package. This allows `pnpm` to correctly handle configured `publishConfig.directory`.
