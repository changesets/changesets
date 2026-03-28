---
"@changesets/apply-release-plan": patch
---

Fix `shouldUpdateDependencyBasedOnConfig` incorrectly treating all `workspace:^x.y.z` ranges as out-of-range. Semver cannot parse the `workspace:` prefix, so it always returned `false` for `semverSatisfies`, causing dependents to be unnecessarily bumped even when the new version was within the specified range. The fix strips the `workspace:` prefix before the semver comparison, and explicitly handles the implicit workspace aliases (`workspace:^`, `workspace:~`, `workspace:*`) which are not real semver ranges.
