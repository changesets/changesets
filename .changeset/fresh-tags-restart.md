---
"@changesets/assemble-release-plan": patch
"@changesets/cli": patch
---

The prerelease number now starts over at 0 after changing the prerelease tag, e.g. `1.0.0-beta.3` is followed by `1.0.0-rc.0` instead of `1.0.0-rc.4`.
