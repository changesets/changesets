# Checking for changesets

Using `@changesets/cli`, there is a `status` command. See the docs for it in the
[@changesets/cli readme](../packages/cli/README.md#status)

We have a [github bot](https://github.com/apps/changeset-bot) and a
[bitbucket addon](https://bitbucket.org/atlassian/atlaskit-mk-2/src/master/build/bitbucket-release-addon/) that
alert users of missing changesets.

If you want to cause a failure in CI on missing changesets (not recommended), you can run `changeset status --since-master`,
which will exit with a status code of 1 if there are no new changesets.
