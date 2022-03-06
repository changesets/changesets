---
"@changesets/apply-release-plan": major
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Allow "commit" option to be configurable via CommitFunctions

- Moves all git commit logic to the cli, along with resolving the commit config
- apply-release-plan no longer commits the release info
