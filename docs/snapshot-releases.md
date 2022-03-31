# Snapshot Releases

Snapshot releases are a way to release your changes for testing without updating the versions. Both a modified `version` and a modified `publish` command are used to do accomplish a snapshot release. After both processes run, you will have a published version of packages in changesets with a version of `0.0.0-{tag}-DATETIMESTAMP`.

## Starting Off

Create changesets as normal, as described in [adding a changeset](./adding-a-changeset.md). When you are ready to release a snapshot, you should make a dedicated branch for doing so.

## Versioning your packages

```
yarn changeset version --snapshot
```

This will apply the changesets, but instead of using the next version, all versions will be set to `0.0.0-THE_TIME_YOU_DID_THIS`.

If you want to add a personalised part to this version number, such as `bulbasaur`, you can run

```
yarn changeset version --snapshot bulbasaur
```

This will instead update versions to `0.0.0-bulbasaur-THE_TIME_YOU_DID_THIS`

## Publishing your packages

After running the `yarn changeset version` command, you can use the `changeset publish --tag bulbasaur` command to releases the packages. By using the `--tag` flag, you will not add it to the `latest` flag on npm. This is REALLY IMPORTANT because if you do not include a tag, people installing your package using `yarn add your-package-name` will install the snapshot version.

## Using the `--no-git-tag` flag

You can use the `--no-git-tag` CLI flag when running `changeset publish` if you plan to publish snapshot releases locally or you are pushing [git tags](http://npm.github.io/publishing-pkgs-docs/updating/using-tags.html) to a remote from your CI environment.

When you run `changeset publish --no-git-tag --snapshot`, changesets will skip creating git tags for published snapshot packages. That means that git tags can still be created whenever pushing stable versions (with a regular `changeset publish`), and you can safely publish snapshot releases locally, without creating unnecessary tags.

## Using a snapshot version

When you want to get people to test your snapshots, they can either update their package.json to your newly published version and run an install, or use `yarn add your-package-name@YOUR_TAG_OR_VERSIONS`

For our above example, you could run

```
yarn add your-package-name@0.0.0-bulbasaur-THE_TIME_YOU_DID_THIS
```

or the tag:

```
yarn add your-package-name@bulbasaur
```

## What to do with the snapshot branch

In almost all circumstances, we recommend that the changes after you have run `version` get merged back into your main branch. With snapshots, this is not the case. We recommend that you do not push the changes from this running of `version` to any branch. This is because the snapshot is intended for installation only, not to represent the correct published state of the repo. Save the generated version, and the tag you used, but do not push this to a branch you are planning to merge into the main branch, or merge it into the main branch.

## Automatic snapshots on PRs

You can automatically generate snapshots on pull requests with GitHub Actions:

```yaml
name: Pre-release

on: pull_request

jobs:
  publish_prerelease:
    runs-on: ubuntu-latest
    if: github.repository == 'johndoe/examplerepo' # replace with yours
    steps:
      - uses: actions/checkout@v2

      - name: Use Node.js 14.x
        uses: actions/setup-node@v2
        with:
          node-version: "14"

      - name: Install Dependencies
        run: yarn

      - name: Publish Pre-release
        run: |
          COMMIT_SHA=${{ github.event.pull_request.head.sha }}
          COMMIT_SHA_SHORT=$(git rev-parse --short "$COMMIT_SHA")
          yarn changeset version --snapshot prerelease-$COMMIT_SHA_SHORT
          yarn changeset publish --tag prerelease
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This will generate a snapshot on each commit to a PR using the commit `SHA`, and publish it under the `prerelease` tag. This is very handy if you need to incrementally test out changes in your PR and don't want to generate snapshots manually for each commit.

There is an **unintended consequence** to this for brand new packages that have never been published to npm before. You can read more about it in the [changeset publish docs](./command-line-options.md#unintended-first-time-publish).
