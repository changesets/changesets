# Snapshot Releases

Snapshot releases are a way to release your changes for testing without updating the versions. This can be useful for releasing preview versions from PRs, nightly releases from the `main` branch, etc. These steps can be run in CI to automate the process of snapshot releases.

Both a modified [`version`](./cli.md#version) and [`publish`](./cli.md#publish) commands are used to do a snapshot release. After both commands run, you will have a published version of packages in changesets with a version like `0.0.0-{tag}-{datetime}`.

::: info Alternatives
You can also use services such as [pkg.pr.new](https://pkg.pr.new) to easily set up snapshot releases. They publish to their own registry as ephemeral releases to prevent polluting versions and tags on npm.
:::

## Starting Off

Create changesets as normal. When you are ready to release a snapshot, create a dedicated branch for doing so.

## Versioning

::: code-group

```bash [pnpm]
$ pnpm changeset version --snapshot
```

```bash [npm]
$ npx @changesets/cli version --snapshot
```

```bash [yarn]
$ yarn changeset version --snapshot
```

:::

This will apply the changesets, but instead of using the next version, all versions will be set to `0.0.0-{datetime}`.

If you want to add a personalized part to this version number, such as `bulbasaur`, you can run:

::: code-group

```bash [pnpm]
$ pnpm changeset version --snapshot bulbasaur
```

```bash [npm]
$ npx @changesets/cli version --snapshot bulbasaur
```

```bash [yarn]
$ yarn changeset version --snapshot bulbasaur
```

:::

This will instead update versions to `0.0.0-bulbasaur-{datetime}`.

## Publishing

Run `publish --tag bulbasaur` to publish the packages. By using the `--tag` flag, you will not add it to the `latest` [dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) on npm.

If you did not set a name when running `version --snapshot`, you should still use `--tag` to not publish it to the `latest` dist-tag. Use a random name like `publish --tag snapshot`.

::: danger Always use a tag for snapshots
This is **REALLY IMPORTANT** because if you do not include a tag, installing your package will default to the snapshot version, which is not what you want.
:::

## Disabling git tags

When publishing snapshot releases, you may not want to create git tags as they may be temporary only. Use `publish --no-git-tag` to skip creating git tags for snapshot releases.

## Using a snapshot version

When you want to get people to test your snapshots, they can either update their package.json to your newly published version and run an install, or use the install command directly:

::: code-group

```bash [pnpm]
$ pnpm add your-package-name@0.0.0-bulbasaur-{datetime}
```

```bash [npm]
$ npm install your-package-name@0.0.0-bulbasaur-{datetime}
```

```bash [yarn]
$ yarn add your-package-name@0.0.0-bulbasaur-{datetime}
```

:::

Or you can install with the dist-tag:

::: code-group

```bash [pnpm]
$ pnpm add your-package-name@bulbasaur
```

```bash [npm]
$ npm install your-package-name@bulbasaur
```

```bash [yarn]
$ yarn add your-package-name@bulbasaur
```

:::

## What to do with the snapshot branch

In almost all circumstances, we recommend that the changes after you have run `version` get merged back into your main branch. With snapshots, this is not the case. We recommend that you do not push the changes from this running of `version` to any branch. This is because the snapshot is intended for installation only, not to represent the correct published state of the repo. Save the generated version, and the tag you used, but do not push this to a branch you are planning to merge into the main branch, or merge it into the main branch.
