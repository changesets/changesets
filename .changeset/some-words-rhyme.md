---
"@changesets/apply-release-plan": major
---

Bumping `devDependencies` no longer bumps the packages that they depend on.

This is a pretty big "quality of life" update, which means we will do fewer releases of packages overall, as there is no change of installed packages.

This has been made a breaking chage as it changes the behaviour of what will be published. It should only be for the better, but we didn't want to surprise you with it.
