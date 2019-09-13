---
"@changesets/cli": major
---

#### Changelog generation functions have minor changes

In addition to how these functions are defined (see changes to config), the data that is passed through
to these functions is notably different to what it was before. For the most part, the changelog functions
simply receive richer information, based on the new changelog format.

**BREAKING**: The release objects and dependency release objects now use `release.newVersion` for the latest
version, instead of the previous `release.version`.

The `@changesets/types` package includes exports for both `GetReleaseLine` as well as `GetDependencyReleaseLine`.

If you were using the default changelog generation scripts, you won't need to worry. Otherwise, we recommend updating
your command and manually running `version` to ensure you are still getting the changelogs you expect.

**Looking further forward** We are already aware that we want to change how people write these generation functions,
including opening up more flexibility, and access to things such as the underlying release plan. This will likely require
a breaking change in the future, but we thought we were changing enough this release that we didn't want too much turmoil. 😁
