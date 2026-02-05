# @changesets/changelog-github

> A changelog entry generator for GitHub that links to commits, PRs and users

[![npm package](https://img.shields.io/npm/v/@changesets/changelog-github)](https://npmjs.com/package/@changesets/changelog-github)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

This package generates changelog entries that include links to GitHub commits, pull requests, and user profiles, making your changelog more informative and navigable.

## Installation

```bash
npm install @changesets/changelog-github
# or
yarn add @changesets/changelog-github
# or
pnpm add @changesets/changelog-github
```

## Usage

To use this changelog generator, update your `.changeset/config.json`:

```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]
}
```

Replace `"org/repo"` with your GitHub repository (e.g., `"changesets/changesets"`).

### GitHub Token

To fetch information from GitHub (especially for private repositories or to avoid rate limits), you can provide a GitHub token via the `GITHUB_TOKEN` environment variable:

```bash
GITHUB_TOKEN=your_token_here npx changeset version
```

### GitHub Enterprise

If you're using GitHub Enterprise, set the `GITHUB_SERVER_URL` environment variable:

```bash
GITHUB_SERVER_URL=https://github.your-company.com npx changeset version
```

## Changeset Summary Features

You can include additional metadata in your changeset summaries that this generator will parse:

### Pull Request Reference

```md
---
"your-package": minor
---

pr: #123

Added a new feature
```

### Commit Reference

```md
---
"your-package": patch
---

commit: abc1234

Fixed a bug
```

### Author Attribution

```md
---
"your-package": minor
---

author: @username

Added a feature
```

You can combine these:

```md
---
"your-package": minor
---

pr: #123
author: @contributor

Added an awesome new feature
```

## Example Output

The generated changelog entries will look like:

```md
## 1.0.0

### Minor Changes

- [#123](https://github.com/org/repo/pull/123) [`abc1234`](https://github.com/org/repo/commit/abc1234) Thanks [@contributor](https://github.com/contributor)! - Added an awesome new feature

### Patch Changes

- Updated dependencies [[`def5678`](https://github.com/org/repo/commit/def5678)]:
  - dependency-package@2.0.0
```
