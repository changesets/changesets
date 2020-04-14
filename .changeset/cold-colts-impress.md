---
"@changesets/apply-release-plan": minor
---

Expose getReleasesWithChangelogs function from apply-release-plan

This method attaches the generated markdown changelog entries to the release plan. This allows consumers to access the changelog entries programatically without having to apply the release plan and write changes to disk.
