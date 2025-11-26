---
"@changesets/get-github-info": minor
---

Support GitHub URL environment variables

`@changesets/get-github-info` will now respect environment variables [set by GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/variables), specifically:

- `GITHUB_GRAPHQL_URL`
- `GITHUB_SERVER_URL`

This means GitHub Enterprise Server will be supported without any additional configuration or patching.
