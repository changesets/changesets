## "@changesets/cli": patch

For pnpm projects, Changesets now match pnpm's native registry behavior more closely during unpublished package checks. Scope-based `publishConfig` registry overrides are no longer supported there, and `publishConfig.registry` is used instead.
