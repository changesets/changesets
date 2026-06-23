---
"@changesets/apply-release-plan": major
"@changesets/assemble-release-plan": major
"@changesets/cli": major
"@changesets/pre": major
"@changesets/release-utils": major
"@changesets/types": major
---

When exiting prerelease mode, the final changelog will now not include all changesets made since `pre enter`. This change was made as often changes during prereleases are not relevant to the final release, and it's not possible to query the entire Git and GitHub metadata when the backlog of changesets become sufficiently large.

As a result, the `pre.json` file also no longer tracks changesets added since `pre enter`, and `version` commands during prereleases will clear all changesets same as a normal release.

If you're migrating to Changesets v3 during prerelease mode, this new behavior will be automatically applied the next time you run the `version` command. Specifically, the `pre.json` `"changesets"` field will be cleared, and all of its referenced changesets will be deleted in `.changeset/*.md`.
