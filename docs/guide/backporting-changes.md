# Backporting Changes

Sometimes, you may need to backport changes to a previous versions for important bug fixes or security patches. Changesets can also be configured to make this process easier.

## Setting Up

Releases for previous versions require a separate branch for the version. For example, to backport to `1.x` versions, you can create a `v1` branch based on the git tag of the last `1.x` release.

```bash
$ git checkout -b v1 v1.2.3
```

Then, update the [`baseBranch`](./config.md#baseBranch) option with the branch name. This allows the [`add`](./cli.md#add) command to properly detect the changed packages.

```json [.changeset/config.json]
{
  "baseBranch": "v1"
}
```

If you have set up CI to [automatically run version and publish](./automating.md#how-do-i-run-the-version-and-publish-commands), make sure to allow running the workflow for this branch too.

Also ensure the `publish` command is passed a custom `--tag` as we do not want backport releases to be tagged as `latest` on npm.

```bash
$ changeset publish --tag previous
```

::: danger Remember to set a tag
This is **REALLY IMPORTANT** because if you do not include a tag, installing your package will default to the backport version, which is not what you want.
:::

Commit the changes and push the branch to your remote.

```bash
$ git add .
$ git commit -m "Set up backport branch"
$ git push -u origin v1
```

## Releasing Backport Versions

When you want to release a backport version, you can run the [`version`](./cli.md#version) and [`publish`](./cli.md#publish) commands as usual. See the [Versioning and Publishing](./versioning-and-publishing.md) guide for the usual flow.

As mentioned above, remember to pass a custom `--tag` if you're running the `publish` command manually.
