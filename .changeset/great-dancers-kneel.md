---
"@changesets/apply-release-plan": minor
"@changesets/assemble-release-plan": minor
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/get-dependents-graph": minor
"@changesets/types": minor
---

New setting added: bumpVersionsWithWorkspaceProtocolOnly. When it is set to `true`, versions are bumped in `dependencies`, only if those versions are prefixed by the workspace protocol. For instance, `"foo": "workspace:^1.0.0"`.
