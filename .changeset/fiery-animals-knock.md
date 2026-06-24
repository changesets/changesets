---
"@changesets/get-github-info": major
---

Rename `getInfo` to `getCommitInfo`, and `getInfoFromPullRequest` to `getPullRequestInfo`. They may now return `undefined` if the commit or pull request is not found in the GitHub repository.

Their return types are also updated to return the direct string and URLs instead of pre-formatted Markdown links. This allows for more flexibility when using the info.

To migrate, you should construct the Markdown links yourself. For example:

```ts
const info = await getCommitInfo({ commit, repo });
if (info == null) return;

const commitLink = `[${info.commit.sha.slice(0, 7)}](${info.commit.url})`;

if (info.author != null) {
  const authorLink = `[@${info.author.login}](${info.author.url})`;
}

if (info.pull != null) {
  const pullLink = `([#${info.pull.number}](${info.pull.url})`;
}
```
