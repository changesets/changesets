> [!WARNING]
> This documentation is outdated. View the up-to-date version at https://changesets.dev/guide/automating#how-do-i-ensure-pull-requests-have-changesets

# Checking for changesets

Using `@changesets/cli`, there is a `status` command. See the docs for it in the
[@changesets/cli readme](../packages/cli/README.md#status)

We have a [github bot](https://github.com/apps/changeset-bot) and a
[bitbucket addon](https://bitbucket.org/atlassian/atlaskit-mk-2/src/master/build/bitbucket-release-addon/) that
alert users of missing changesets.

If you want to cause a failure in CI on missing changesets (not recommended), you can run `changeset status --since=main`,
which will exit with a status code of 1 if there are changed packages but no new changesets. It will not fail if there are no changed packages.

## Validating changesets

If changesets are created or edited by hand (or by an AI tool), they may end up
malformed or reference packages that no longer exist in the workspace. This
typically surfaces as an error during `changeset version` on the release branch.

To catch these issues earlier, run:

```
changeset check
```

This validates that every changeset in `.changeset/`:

- is well-formed (valid frontmatter with package names and version types), and
- only references packages that still exist in the workspace.

It exits with code `1` on the first invalid changeset, printing the offending
file and the reason. Use it in CI on your main branch (or on pull requests)
before `changeset version` runs to prevent broken releases.
