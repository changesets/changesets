# Automating Changesets

While Changesets is designed to work with a fully manual process, it also provides tools to help automate these releases. These can be broken into two major decisions:

1. How do I ensure pull requests have changesets?
2. How do I run the version and publish commands?

Here is a quick-start recommended workflow and more customization details.

## Recommended Automation Flow

1. Install the [Changesets GitHub Bot](https://github.com/apps/changeset-bot) into your repository.
2. Add the [Changesets GitHub Action](https://github.com/changesets/action) to your repository.

## How do I ensure pull requests have changesets?

Changesets are committed to files, so a diligent reviewer can always technically tell if a changeset is absent and request one to be added. As humans though, a file not being there is easy to miss.

We recommend adding some way to detect the presence or absence of changesets on a pull request so you don't have to, as well as highlight it directly to the pull request author.

This has two main approaches.

### Non-blocking

In this approach, a pull request may be merged if no changeset is present, and a missing changeset does not cause a failure in CI. Our [Changesets GitHub Bot](https://github.com/apps/changeset-bot) is the best way to prompt for changesets without making them blocking.

It comments on PRs of whether changesets are present and gives you link to add your own changeset as a maintainer to smooth over merging pull requests without waiting for the contributor to add a changeset.

### Blocking

As not every change requires a release, we **do not recommend** blocking contributions in the absence of a changeset. However, if you prefer a consistent process that always requires a changeset, you can add a step in your CI setup that runs:

::: code-group

```bash [pnpm]
$ pnpm changeset status --since main
```

```bash [npm]
$ npx @changesets/cli status --since main
```

```bash [yarn]
$ yarn changeset status --since main
```

:::

This will exit with code `1` if there are changed packages but no new changesets since main. It will not fail if there are no changed packages.

If you want to merge a change without doing any releases (such as when you only change tests or build tools), you can run `changeset --empty` to add a special changeset that does not release anything.

## How do I run the version and publish commands?

You can set up the [Changesets GitHub Action](https://github.com/changesets/action) to automate this process:

- It creates a `version` PR, then keeps it up to date, recreating it when merged.
- Optionally, if publishing is set up, it automatically publishes the release whenever the PR is merged.

If you do not want to use this action, the manual workflow we recommend is:

1. A release coordinator (RC) calls to stop any merging to the base branch
2. The RC pulls down the base branch, runs `changeset version`, then makes a new PR with the versioning changes
3. The versioning changes are merged back into the base branch
4. The RC pulls the base branch again and runs `changeset publish`
5. The RC runs `git push --follow-tags` to push the release tags back
6. The RC unblocks merging to the base branch

This is a lot of steps and is quite finicky (we have to pull from the base branch twice). Feel free to finesse it to your own circumstances.
