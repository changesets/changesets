---
"@changesets/cli": minor
---

The new `changeset tag` command has been added. It can be used to create git tags for all packages.

This is helpful in situations where a different tool is used to publish packages instead of Changesets. For situations where `changeset publish` is executed, running `changeset tag` is not needed.

Note that it is expected that `changeset version` is run before `changeset tag`, so that the `package.json` versions are updated before the git tags are created. This command also doesn't take any configuration into account - it simply create tags for all packages with whatever version that is currently in their respective `package.json`.
