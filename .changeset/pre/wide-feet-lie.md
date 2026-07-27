---
"@changesets/assemble-release-plan": major
"@changesets/cli": major
---

Peer dependencies now bump packages that depend on them by `patch` instead of `major`.

This means a peer dependency update is no longer assumed (forced) to be a breaking change.

If the dependent package is not compatible with the peer's new release you should manually add a `major` changeset describing why and how to migrate.
