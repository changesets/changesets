# Versioning and Publishing

Once you have accumulated some changesets, you can use the CLI to update the versions and changelogs of your packages, and publish them to npm.

This process is split into two steps: versioning and publishing.

## Versioning

Run the [`version`](./cli.md#version) command to update the package versions and changelogs:

::: code-group

```bash [npm]
$ npx @changesets/cli version
```

```bash [pnpm]
$ pnpm changeset version
```

```bash [yarn]
$ yarn changeset version
```

:::

Review the changes, ensure the versions and changelogs are updated as expected, and commit them to your repository.

## Publishing

Run the [`publish`](./cli.md#publish) command to publish the new versions of the packages:

::: code-group

```bash [npm]
$ npx @changesets/cli publish
```

```bash [pnpm]
$ pnpm changeset publish
```

```bash [yarn]
$ yarn changeset publish
```

:::

You can also create git tags for the published versions by passing the `--git-tag` flag. If you have published without git tags, you can still run the [`tag`](./cli.md#tag) command to create tags for the current published versions.

Make sure to push the tags to your git remote after creating them.

```bash
$ git push --follow-tags
```

And you have released your changes! When you add more changesets again, repeat the process to continue releasing new versions of your packages.

Check out the [CI automation](./automating.md) guide to simplify versioning and publishing so that releasing is as simple as merging a PR.

## Publishing for the First Time

For packages that are being published for the first time, make sure that the [`access`](./config.md#access) option is properly set. If all your packages are public, set it to `public`:

```json [.changeset/config.json]
{
  "access": "public"
}
```

If only some are public, use the `publishConfig.access` field in the `package.json` for those packages:

```json [package.json]
{
  "name": "@scope/pkg-a",
  "version": "1.0.0",
  "publishConfig": {
    "access": "public"
  }
}
```

If you have private packages, make sure you have [permissions](https://docs.npmjs.com/creating-and-publishing-private-packages#direct-publishing) to publish them. In CI, you will need to pass an [access token](https://docs.npmjs.com/about-access-tokens) to the workflow.

::: warning Protect your access tokens
Always take special care of access tokens and do not leak them in your CI workflow. Only pass them to the steps that need them. It is otherwise recommended to set up trusted publishing instead.
:::

### Trusted Publishing

If you want to set up [trusted publishing](https://docs.npmjs.com/trusted-publishers) for a new package, you need to first manually publish the package locally, and then update its settings for trusted publishing.

Usually, you can first create a stub package with a `package.json` that looks like this:

```json [package.json]
{
  "name": "pkg-a",
  "version": "0.0.0"
}
```

Then, run `npm publish` and set up trusted publishing in the package settings. Then, create a changeset that bumps to the proper initial version. For example, to start with `0.1.0`:

```md [.changeset/i-love-changesets.md]
---
"pkg-a": minor
---

Initial release
```
