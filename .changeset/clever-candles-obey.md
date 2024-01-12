---
"@changesets/assemble-release-plan": major
"@changesets/cli": major
"@changesets/get-release-plan": major
---

Use semver compat for workspace:^ dependencies.

Prior to this change, all packages depending on an updated package via `workspace:^` got a version bump.
This leads to packages being released that don't need to be according to semver.

This is a bugfix in terms of supporting semver, but it's breaking backwards compatible behavior.

If you're using `workspace:^` dependencies in your project, ensure that changes to dependencies of a package
come with a dedicated changeset for that package.
