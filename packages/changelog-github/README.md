# @changesets/changelog-github

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/changelog-github?name=true)](https://npmx.dev/package/@changesets/changelog-github)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

A [changelog generator](https://changesets.dev/guide/customize-changelog-format) for Changesets that links to GitHub commits, PRs, and authors.

## Usage

The `@changesets/changelog-github` package requires a [`GITHUB_TOKEN`](https://github.com/settings/tokens/new?scopes=read:user,repo:status&description=changesets) with `read:user` and `repo:status` permissions. Add it to your repository's [GitHub Action secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) and your `.env` file:

```bash
GITHUB_TOKEN=token_here
```

Then you can use it in the [`changelog`](https://changesets.dev/guide/config#changelog) option:

```json [.changeset/config.json]
{
  "changelog": ["@changesets/changelog-github", { "repo": "owner/repo" }]
}
```

## Options

### `repo`

- **Type:** `string`
- **Default:** `process.env.GITHUB_REPOSITORY`

Specify the `<org>/<repo>` slug of your GitHub repository. If you intend to run this locally, specify the option explicitly or set the `GITHUB_REPOSITORY` environment variable.

When running in GitHub Actions, `GITHUB_REPOSITORY` is automatically set, so you can omit this option if you are only running in GitHub Actions.

### `disableThanks`

- **Type:** `boolean`
- **Default:** `false`

Set `true` to drop the `"Thanks [@user]!"` attribution from each line.

> [!NOTE]
> It is recommended to not set `"disableThanks": true` when using the `template` option as the `{authors}` token would return an empty string, which could lead to unexpected results.

### `template`

- **Type:** `string`
- **Experimental**

> [!WARNING]
> **Experimental.** The `template` option and its token syntax may change in any release, including a patch. If you rely on it, pin the exact `@changesets/changelog-github` version.

This option allows you to customize the format that should be used for the generation of a single changelog line. For example, the default template generates this Markdown:

```md
- [#123](https://github.com/<org>/<repo>/pull/123) [`a1b2c3d`](https://github.com/<org>/<repo>/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0) Thanks [@ghost](https://github.com/ghost)! - fix the thing
```

Each piece of information can be dynamically represented with [tokens](#tokens). The above example can be represented as:

```
\n\n- {pull} {commit} Thanks {authors}! - {summary}
```

#### Tokens

The `template` option supports these tokens.

| Token       | Description                                                                                    | Example              |
| ----------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| `{summary}` | The first line of the changeset Markdown content.                                              | `fix the thing`      |
| `{ref}`     | Link to either the PR or commit (if the changes were pushed directly). Wrapped in parenthesis. | `([#123](url))`      |
| `{pull}`    | Link to the PR if available.                                                                   | `[#123](url)`        |
| `{commit}`  | Link to the commit.                                                                            | ``[`abc1234`](url)`` |
| `{authors}` | Link to the GitHub user profile of the main author of the commit (and PR).                     | `[@ghost](url)`      |

> [!NOTE]
> If a token is used and its data is absent, the token will generate an empty string. The continuation lines of a multi-line summary are also always appended below the template, indented by two spaces.

Examples:

| `template`                                              | Generated Markdown                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `"\n\n- {pull} {commit} Thanks {authors}! - {summary}"` | ``\n\n- [#123](url) [`abc1234`](url) Thanks [@ghost](url)! - fix the thing``  |
| `"\n\n- {summary} {ref}"`                               | `\n\n- fix the thing ([#123](url))` or ``- fix the thing ([`abc1234`](url))`` |
| `"\n\n- {summary} (thanks {authors}!)"`                 | `\n\n- fix the thing (thanks [@ghost](url)!)`                                 |
| `"\n\n- {summary} {pull}"`                              | `\n\n- fix the thing [#123](url)`                                             |
