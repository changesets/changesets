---
"@changesets/apply-release-plan": major
"@changesets/assemble-release-plan": major
"@changesets/cli": major
"@changesets/git": major
"@changesets/pre": major
"@changesets/read": major
"@changesets/release-utils": major
"@changesets/types": major
---

Move versioned prerelease changesets to `.changeset/pre/` folder instead of accumulating in the root and tracking the versioned changeset ids in the `.changeset/pre.json` file. Existing `pre.json` will auto-migrate to this new structure on the next run of `changeset version` or when calling `changeset status`.

This change allows easier management of versioned prerelease changesets (for the final stable release) and current queued changesets (for the next prerelease). Changesets in `.changeset/pre/` can be edited or deleted depending if it's still relevant for the final stable release of a package. There's no need to synchronize the changeset ids in `pre.json` if certain changesets are deleted.
