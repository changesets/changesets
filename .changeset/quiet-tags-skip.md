---
"@changesets/cli": patch
---

Respect `--no-git-tag` when tagging private packages: `changeset publish --no-git-tag` no longer creates git tags for untagged private packages when `privatePackages.tag` is enabled.
