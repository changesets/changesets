# Automating Changesets

Changesets provides first-class support to automate the release process on GitHub. Generally, this can be broken into two major decisions:

1. How do I ensure pull requests have changesets?
2. How do I run the version and publish commands?

## Toolings

This guide uses these tools to automate the release process. Check out their documentation for specific information on setting up and supported APIs.

- [Changesets GitHub Bot](https://github.com/apps/changeset-bot)
- [Changesets GitHub Action](https://github.com/changesets/action)

## How do I ensure pull requests have changesets?

Changesets are committed to files, so a diligent reviewer can always technically tell if a changeset is absent and request one to be added. As humans though, a file not being there is easy to miss.

We recommend adding some way to detect the presence or absence of changesets on a pull request so you don't have to, as well as highlight it directly to the pull request author.

This has two main approaches: non-blocking and blocking.

### Non-blocking

In this approach, a pull request may be merged if no changeset is present, and a missing changeset does not cause a failure in CI. The [Changesets GitHub Bot](https://github.com/apps/changeset-bot) is the easiest way to prompt for changesets without making them blocking.

Alternatively, you can use the [Changesets GitHub Action](https://github.com/changesets/action) to write a custom workflow that does the check.

::: danger DO NOT RUN UNTRUSTED CODE
Do not run untrusted code when using the [`pull_request_target`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target) event.

`pull_request_target` can be useful to support PRs from forks, however it enables write permissions by default which can be a security risk if untrusted code is executed and the permissions aren't scoped down.

The example below only **_checks out_** and **_reads_** code, and does not **_execute_** any code from the fork.

You can also use the `pull_request` event if you prefer to lock permissions down and not run for PRs from forks. Make sure to add an if check to prevent the action from failing in fork PRs:

```yaml
jobs:
  pr-status:
    if: github.event.pull_request.head.repo.full_name == github.repository
    # ...
```

:::

<<< ./_snippets/automating-non-blocking.yaml [.github/workflows/comment-changesets-pr-status.yml]

Both approaches comment on PRs of whether changesets are present and gives you link to add your own changeset as a maintainer to smooth over merging pull requests without waiting for the contributor to add a changeset.

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

This will exit with code `1` if there are changed packages but no new changesets since `main`. It will not fail if there are no changed packages.

If you want to merge a change without doing any releases (such as when you only change tests or build tools), you can run `changeset --empty` to add a special changeset that does not release anything.

## How do I run the version and publish commands?

You can set up the [Changesets GitHub Action](https://github.com/changesets/action) to automate this process. The workflow varies depending if you publish with Trusted Publishing, with npm tokens, or without publishing at all.

Generally, the setup we recommend works like this:

```dot
digraph {
  ranksep=0
  node [shape=box margin="0.3,0" fontname="Inter" fontsize=10 fontcolor="${#000000|#ffffff}" color="${#c2c2c4|#3c3f44}"]
  edge [fontname="Inter" fontsize=9 fontcolor="${#67676c|#98989f}" color="${#67676c|#98989f}"]
  bgcolor="transparent"

  start [label="Has changesets?"];
  version [label="Version packages and create/update PR"];
  publishable [label="Are there any publishable packages?"];
  publish [label="Publish packages"];
  skip [label="Do nothing"];

  start -> version [label="YES"];
  start -> publishable [label="NO"];
  publishable -> publish [label="YES"];
  publishable -> skip [label="NO"];
}
```

### Prerequisites

As the Changesets GitHub Action creates pull requests for versioning, ensure in your repository settings, in `Actions > General`, the `Allow GitHub Actions to create and approve pull requests` option is enabled.

If this is not enabled, you may encounter errors such as:

- `remote: Permission to xxx.git denied to github-actions[bot]`
- `GitHub Actions is not permitted to create or approve pull requests`

### Trusted Publishing

It is recommended by npm to use [Trusted Publishing](https://docs.npmjs.com/trusted-publishers), or [Staged Publishing](https://docs.npmjs.com/staged-publishing), or both, to securely publish packages from CI.

At the moment, Staged Publishing does not work with Changesets, so you should use Trusted Publishing instead for now. Check out [its docs](https://docs.npmjs.com/trusted-publishers) for more information to set it up.

Also, in contrary to npm's [workflow recommendation](https://docs.npmjs.com/trusted-publishers#step-2-configure-your-cicd-workflow), make sure the `id-token: write` is only set on the job that needs to publish. As such, consider splitting the build, test, publish flows etc into separate jobs. Here's an example setup:

<<< ./_snippets/automating-trusted-publishing.yaml [.github/workflows/publish.yml]

::: tip Require approval before publishing
You can also consider [creating an environment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments#creating-an-environment) with required reviewers to approve the publish job run. Set the environment name on the `publish` job [`environment`](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments#creating-an-environment) property to require their approval before the publish job can continue. This is one way to ensure that only trusted maintainers can publish packages.
:::

### Token-based Publishing

::: warning
Token-based publishing (with [Granular Access Tokens](https://docs.npmjs.com/about-access-tokens#about-granular-access-tokens)) is **no longer recommended**, with many restrictions that make it difficult to use in CI workflows. For example:

- They expire after a maximum of 90 days, which requires periodic manual token rotation.
- 2FA-bypass tokens are [being deprecated](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/#2fa-bypass-tokens-will-no-longer-publish-directly) and will soon be not allowed to publish packages with 2FA enabled.

However, if you're using a different npm-compatible registry that does not support Trusted Publishing or Staged Publishing, you may still opt for token-based publishing.
:::

You'll need an [npm token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) with "Bypass two-factor authentication" checked to prevent npm requesting 2FA in CI. [Add this token as a secret](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) in your GitHub repo with the name `NPM_TOKEN` so it can be used in the workflow below.

In most cases, you can use [actions/setup-node](https://github.com/actions/setup-node) to set up token-based authentication:

<<< ./_snippets/automating-token-based-publishing.yaml [.github/workflows/publish.yml]

::: details Alternative simplified workflow for private repos with trusted contributors
<<< ./_snippets/automating-token-based-publishing-simplified.yaml [.github/workflows/publish.yml]
:::

::: v-pre
::: tip
Pass `registry-url: https://npm.pkg.github.com/` and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to publish to the GitHub Package Registry instead of npm.
:::

### Publish Git Tags Only

In case you have a separate workflow to publish your packages, e.g. workflows triggered on git tags creation, you can use Changesets to only create git tags on publish.

This requires making your packages' `package.json` `"private": true` and setting [`privatePackages`](./config.md#privatepackages) to `true`. See the [Beyond npm](./beyond-npm.md) guide for more information.

You can use the following workflow, similar to [Token-based Publishing](#token-based-publishing) above, but without the `registry-url` and `NODE_AUTH_TOKEN` set for npm authentication:

<<< ./_snippets/automating-publish-git-tags-only.yaml [.github/workflows/publish.yml]

### Version Only

If you do not plan to publish your packages, or only using Changesets to manage changelogs, you can configure a workflow that only versions your packages.

<<< ./_snippets/automating-version-only.yaml [.github/workflows/version.yml]

## Additional Notes

### Understanding npm Authentication

When using `actions/setup-node` with the `registry-url` option, internally it will set up a `.npmrc` file that looks like this:

```ini
//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
```

This syntax allows to authenticate with the npm registry only when the `NODE_AUTH_TOKEN` environment variable is set, which is the safer approach than storing the token directly in the `.npmrc` file.

For advanced use cases, you can also set up the [`~/.npmrc` file](https://docs.npmjs.com/cli/configuring-npm/npmrc) manually. Make sure to remove the `registry-url` option from `actions/setup-node` to prevent conflicts with your custom `.npmrc` file.

For example, if you need to publish different scopes to different registries, you can set up the `~/.npmrc` file like below:

```yaml
- run: |
    cat << 'EOF' > ~/.npmrc

    # For unscoped packages, publish to the default npm registry
    //registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}

    # For @foo/* packages, publish to a custom registry
    @foo:registry=https://my-registry.com/
    //my-registry.com/:_authToken=${NODE_FOO_AUTH_TOKEN}

    # For @bar/* packages, publish to the GitHub Package Registry
    @bar:registry=https://npm.pkg.github.com/
    //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

    EOF
```

### Run GitHub Actions for Version PRs

By default, PRs created by GitHub Actions [do not trigger workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow) for the PR. However, you can still manually trigger the workflow from the UI.

To always automatically run workflows for version PRs, you need to use either a personal GitHub token or a GitHub App token, and pass it to the Changesets GitHub Action. To set up with a GitHub App token:

```yaml
jobs:
  # ...
  version:
    # ...
    runs-on: ubuntu-latest
    permissions:
      contents: read # to check out repo (actions/checkout)
    steps:
      # ...

      - name: Create GitHub App Token
        uses: actions/create-github-app-token@v3
        id: app-token
        with:
          client-id: ${{ vars.APP_CLIENT_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          permission-contents: write # to commit version changes (changesets/action/version)
          permission-pull-requests: write # to create pull request (changesets/action/version)

      - name: Version packages
        uses: changesets/action/version@v2
        with:
          github-token: ${{ steps.app-token.outputs.token }}
```

Check the [actions/create-github-app-token](https://github.com/actions/create-github-app-token) documentation for details on setting up `vars.APP_CLIENT_ID` and `secrets.APP_PRIVATE_KEY`.

Also, make sure version commits and merge commits do not contain `[skip ci]` ([or any variants](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)) that would skip the workflow from running. This may happen when configuring the `commit-message` for `changesets/action/version` or the Changesets [`commit`](./config.md#commit) config's `skipCI` option, which could cause tests or publish steps to not execute.

### pnpm

An `.npmrc` file in a project directory with pnpm does not support environment variables due to [security reasons](https://pnpm.io/blog/2026/06/11/env-variables-in-repository-npmrc). As such, it's recommended to set up in the home directory instead. This is also the general recommendation for other package managers to not mix potential existing config setups in projects.

### yarn

[Yarn](https://yarnpkg.com) does not support the `.npmrc` file. To set up authentication for yarn, use a [`~/.yarnrc.yml` file](https://yarnpkg.com/configuration/yarnrc) instead:

```yaml
- run: |
    cat << 'EOF' > ~/.yarnrc.yml
    npmAuthToken: "${NODE_AUTH_TOKEN}"
    EOF
```

For advanced use cases, such as if you need to publish different scopes to different registries, you can set up the `~/.yarnrc.yml` file like below:

```yaml
- run: |
    cat << 'EOF' > ~/.yarnrc.yml

    npmAuthToken: "${NODE_AUTH_TOKEN}"

    npmScopes:
      foo:
        npmRegistryServer: "https://my-registry.com/"
        npmAuthToken: "${NODE_FOO_AUTH_TOKEN}"
      bar:
        npmRegistryServer: "https://npm.pkg.github.com/"
        npmAuthToken: "${GITHUB_TOKEN}"

    EOF
```

<style>
.vp-doc._guide_automating [class*='language-'] pre {
  max-height: 70vh;
  overflow-y: auto;
}

/*
  Workflows are all very dense, so shrink the size a bit to fit more text.
  This is the same size for code blocks within a details block.
*/
.vp-doc._guide_automating [class*='language-yaml'] pre {
  font-size: 0.875rem;
}
</style>
