---
"@changesets/cli": major
---

Packages with only prerelease versions published will now be published with the prerelease tag in the prerelease mode _if_ the target registry doesn't auto-assign `latest` tag. npm registry itself does that and such packages will continue to be released with `latest` tag (and not with the configured prerelease tag).
