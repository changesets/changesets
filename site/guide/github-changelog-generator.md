# GitHub Changelog Generator

The `@changesets/changelog-github` generator is an official package from changesets that links to commits, PRs and authors. Learn more about generators in [our "Customize Changelog Format" guide](./customize-changelog-format.md#writing-a-custom-changelog-generator).

## Usage

You can install the GitHub Changelog generator with the following command:

::: code-group

```bash [pnpm]
$ pnpm add -D @changesets/changelog-github
```

```bash [npm]
$ npm install -D @changesets/changelog-github
```

```bash [yarn]
$ yarn add -D @changesets/changelog-github
```

:::

The GitHub Changelog generator requires a [`GITHUB_TOKEN`](https://github.com/settings/tokens/new?scopes=read:user,repo:status&description=changesets) with `read:user` and `repo:status` permissions. Add it to your repository's [GitHub Action secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) and your `.env` file:

```bash
GITHUB_TOKEN=token_here
```

Then you can use it in the [`changelog`](./config.md#changelog) option:

```json [.changeset/config.json]
{
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "owner/repo" }
  ]
}
```

## Options

The GitHub Changelog generator supports the following configuration options:

### `repo`

- **Required**
- **Type:** `string`

Specify the `<org>/<repo>` slug of your GitHub repository.

### `disableThanks`

- **Type:** `boolean`
- **Default:** `false`

Set `"disableThanks": true` to drop the `"Thanks [@user]!"` attribution from each line.

### `template`

- **Type:** `string`
- **Default:** `"\n- {pull} {commit} Thanks {authors}! - {summary}"`

> ⚠️ **Experimental.** The `template` option and its token syntax may change in any release, including a patch. If you rely on it, pin the exact `@changesets/changelog-github` version.

The `template` option allows you to customize the format that should be used for the generation of the first line of individual bullet points in the changelog output. For example, the default template generates this Markdown from one changeset example file:

```
- [#123](https://github.com/<org>/<repo>/pull/123) [`a1b2c3d`](https://github.com/<org>/<repo>/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0) Thanks [@ghost](https://github.com/ghost)! - fix the thing
```

Each piece of information is dynamically represented with a [token](#tokens). The above example uses this `template` syntax:

```
\n- {pull} {commit} Thanks {authors}! - {summary}
```

::: tip
Note that `\n- ` is included to generate each change as a bullet list item. However, you can also drop them and write all changes into a paragraph. Trailing spaces will be trimmed to avoid dangling spaces when the last token is empty.
:::

#### Tokens

The `template` option supports these tokens.

| Token       | Description                                                                               | Example              |
|-------------|-------------------------------------------------------------------------------------------|----------------------|
| `{summary}` | The first line of the changeset Markdown content, linking to GitHub issues (e.g. `#123`). | `fix the thing`      |
| `{ref}`     | Link to either PR, or commit if the changes were pushed directly; wrapped in paranthesis. | `([#123](url))`      |
| `{pull}`    | Link to the PR if available; not wrapped in paranthesis.                                  | `[#123](url)`        |
| `{commit}`  | Link to the commit; not wrapped in paranthesis.                                           | ``[`abc1234`](url)`` |
| `{authors}` | Link to the GitHub user profile of the main author of the commit (and PR).                | `[@ghost](url)`      |

::: info
When you use a token and its data is absent, the token will generate an empty string. Trailing spaces are omitted. Continuation lines of a multi-line summary are always appended below, indented by two spaces.
:::

Here are some examples for the change `"fix the thing"` made in PR `#123` by `@ghost`, squashed in commit `a1b2c3d` to the [`baseBranch`](./config.md#basebranch):

| `template` config                                     | Generated Markdown                                                                   |
|-------------------------------------------------------|--------------------------------------------------------------------------------------|
| `"\n- {pull} {commit} Thanks {authors}! - {summary}"` | ``\n- [#123](url) [`a1b2c3d`](url) Thanks [@ghost](url)! - fix the thing`` (default) |
| `"\n- {summary} {ref}"`                               | `\n- fix the thing ([#123](url))` or ``- fix the thing ([`a1b2c3d`](url))``          |
| `"\n- {summary} (thanks {authors}!)"`                 | `\n- fix the thing (thanks [@ghost](url)!)`                                          |
| `"\n- {summary} {pull}"`                              | `\n- fix the thing [#123](url)`                                                      |
