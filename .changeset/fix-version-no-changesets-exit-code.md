---
"@changesets/cli": patch
---

`changeset version` now exits with code 1 when there are no unreleased changesets, instead of silently exiting with code 0. This makes it easier to detect in CI pipelines when a version step is a no-op — for example, to prevent accidentally publishing packages with incorrect version tags when using `--snapshot` mode.
