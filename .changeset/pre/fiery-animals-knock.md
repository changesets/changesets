---
"@changesets/get-github-info": major
---

Rename `getInfo` to `getCommitInfo`, and `getInfoFromPullRequest` to `getPullRequestInfo`. They may now return `undefined` if the commit or pull request is not found in the GitHub repository.

The return types are also slightly changed but should contain the same information as before. To migrate:

```ts
const info = await getCommitInfo({ commit, repo });
if (info == null) return;

// Before:
const authorLogin = info.user;
const authorLink = info.links.author;

const pullNumber = info.pull;
const pullLink = info.links.pull;

const commitLink = info.links.commit;

// After:
const authorLogin = info.author.login;
const authorLink = info.author.markdownLink;

const pullNumber = info.pull.number;
const pullLink = info.pull.markdownLink;

const commitLink = info.commit.markdownLink;
```

`getPullRequestInfo` also has a similar migration path.
