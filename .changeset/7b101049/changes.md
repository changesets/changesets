Rename commands from @atlaskit/build-releases

We are no longer mirroring the names from npm/yarn commands, so it is easy to write package scripts
for each command without footguns. The functionality of the commands remains the same. In addition,
the binary has been changed to `changeset`.

The new names are:

- `build-releases initialize` => `changeset init` (for ecosystem consistency)
- `build-releases changeset` => `changeset` (default command). You can also run `changeset add`
- `build-releases version` => `changeset bump`
- `build-releases publish` => `changeset release`

The function of these commands remains unchanged.
