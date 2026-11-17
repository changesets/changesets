---
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add support for staging packages for approval before they go live on npm. You can enable it with `"stagedPublishing": true` in your Changesets config or by running `changeset publish --stage`. If staging is enabled in your config, you can use `--no-stage` to publish directly.
