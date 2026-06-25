# @changesets/changelog-github

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/changelog-github?name=true)](https://npmx.dev/package/@changesets/changelog-github)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

A changelog entry generator for GitHub that links to commits, PRs and users.

Enable it in `.changeset/config.json`:

```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "<org>/<repo>" }]
}
```

It requires GitHub authentication: set a `GITHUB_TOKEN` environment variable.

## Options

### `disableThanks` (optional boolean)

Set `"disableThanks": true` to drop the "Thanks [@user]!" attribution from each line.

### `template` (optional string, experimental)

> ⚠ **Experimental.** The `template` option and its token syntax may change in any release, including a patch. If you rely on it, pin the exact `@changesets/changelog-github` version.

By default each changelog line looks like `- [#123](url) [abc1234](url) Thanks [@user](url)! - summary`. Set `template` to render the line yourself from these tokens. Each token renders bare (you write the surrounding spaces) and renders to nothing when its data is absent:

| Token       | Renders                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `{summary}` | the changeset summary's first line, linking every issue reference (`#123`)                                                          |
| `{ref}`     | a single parenthesized reference: `([#123](url))` if there is a PR, else ``([`abc1234`](url))`` for a commit, else nothing          |
| `{pull}`    | `[#123](url)`                                                                                                                       |
| `{commit}`  | ``[`abc1234`](url)``                                                                                                                |
| `{authors}` | `[@user](url)` (the contributors, respects `disableThanks`). For the "Thanks" prefix, write it in the template: `Thanks {authors}!` |

Trailing whitespace on the rendered line is trimmed, so a trailing token that renders empty (e.g. `{ref}` with no PR or commit) leaves no dangling space. When `template` is unset the default output is unchanged. Continuation lines of a multi-line summary are always appended below, indented by two spaces. An unknown token (for example a typo, or the removed `{thanks}`) throws an error during `changeset version`. A token with no value renders as empty text, so a fixed prefix like `Thanks {authors}!` can leave an awkward `Thanks !` when there is no author - write the surrounding text with that in mind.

Examples (for a change with PR `#123`, commit `abc1234`, author `@alice`, summary `fix the thing`):

| `template`                                            | rendered line                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `"\n- {pull} {commit} Thanks {authors}! - {summary}"` | `- [#123](url) [abc1234](url) Thanks [@alice](url)! - fix the thing` (the default) |
| `"\n- {summary} {ref}"`                               | `- fix the thing ([#123](url))` (the compact form)                                 |
| `"\n- {summary} (thanks {authors}!)"`                 | `- fix the thing (thanks [@alice](url)!)`                                          |
| `"\n- {summary} {pull}"`                              | `- fix the thing [#123](url)`                                                      |
