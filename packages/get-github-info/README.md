# @changesets/get-github-info

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/get-github-info?name=true)](https://npmx.dev/package/@changesets/get-github-info)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Get GitHub author and associated PR information for a commit or pull request. Intended for use with changesets.

## Getting Started

> Note: This assumes you already have changesets setup.

You can use `@changesets/get-github-info` like this if you have a [custom changelog formatter](https://github.com/changesets/changesets/blob/main/docs/modifying-changelog-format.md).

```js
import { getCommitInfo } from "@changesets/get-github-info";

// ...

const getReleaseLine = async (changeset, type) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimEnd());

  const info = await getCommitInfo({
    // replace this with your own repo
    repo: "changesets/changesets",
    commit: changeset.commit,
  });
  if (info == null) {
    // may be null if referenced the wrong repo, or the commit has not been pushed
    // to the repo yet
    throw new Error(`Could not get GitHub info for commit ${changeset.commit}`);
  }

  let returnVal = `- [${changeset.commit.sha.slice(0, 7)}](${info.commit.url})`;
  if (info.pull != null) {
    returnVal += ` ([#${info.pull.number}](${info.pull.url})`;
  }
  if (info.author != null) {
    returnVal += ` Thanks [@${info.author.login}](${info.author.url})!`;
  }
  returnVal += `: ${firstLine}`;
  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  }
  return returnVal;
};

// ...
```

You'll need to [get a GitHub personal access token](https://github.com/settings/tokens/new?scopes=read:user,repo:status&description=changesets) with `read:user` and `repo:status` permissions, and add it to a `.env` file (it'll be loaded automatically).

```bash
GITHUB_TOKEN=token_here
```

You can now bump your packages and changelogs with `changeset version` and it'll have the GitHub info. 🎉

### GitHub Enterprise Server

If you are using GitHub Enterprise Server, you can configure `@changesets/get-github-info` to point at it using the following
environment variables:

```bash
GITHUB_SERVER_URL=https://github.example.com
GITHUB_GRAPHQL_URL=https://github.example.com/api/graphql
```

When using GitHub Actions, these environment variables will already have been set.
