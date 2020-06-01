---
"@changesets/assemble-release-plan": patch
"@changesets/config": patch
"@changesets/types": patch
---

Added an experimental flag `onlyUpdatePeerDependentsWhenOutOfRange`. When set to `true`, we only bump peer dependents when peerDependencies are leaving range.
