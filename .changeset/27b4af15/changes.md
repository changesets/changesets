Support non-bolt repositories

Changesets have been expanded to support:

- bolt repositories
- yarn workspaces-based repositories
- single package repositories.

Currently **not** supported: bolt repositories with nested workspaces.

To do this, functions that call out to bolt have been inlined, and obviously marked
within the file-system. In addition, the `get-workspaces` function has undergone
significant change, and will be extracted out into its own package soon.

This is to support other tools wanting this level of inter-operability.

If plans to modularize bolt proceed, we may go back to relying on its functions.

This should have no impact on use.
