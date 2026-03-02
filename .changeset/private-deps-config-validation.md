---
"@changesets/config": patch
---

Allow private packages to depend on skipped packages without requiring them to also be skipped. `devDependencies` on skipped packages no longer trigger a validation error in config parsing (aligning with the existing CLI behavior). The config validation for skipped-package dependents now also covers packages skipped via `privatePackages.version: false`, not just those in the `ignore` list.
