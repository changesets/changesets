# @changesets/get-github-info

[![npm package](https://img.shields.io/npm/v/@changesets/get-github-info)](https://npmjs.com/package/@changesets/get-github-info)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

> Get the GitHub username and PR number from a commit. Intended for use with changesets.

## Getting Started

> Note: This assumes you already have changesets setup.

To use `@changesets/get-github-info`, you'll need to install it and you'll probably also want `dotenv` to provide a GitHub personal access token via a `.env` file.

```bash
yarn add --dev @changesets/get-github-info dotenv
```

or

```bash
npm install --save-dev @changesets/get-github-info dotenv
```

Then you can use it in your `.changeset/config.js` like this.

```jsx
require("dotenv").config();
const { getInfo } = require("@changesets/get-github-info");

// ...

const getReleaseLine = async (changeset, type) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimRight());
  // getInfo exposes the GH username and PR number if you want them directly
  // but it also exposes a set of links for the commit, PR and GH username
  let { user, pull, links } = await getInfo({
    // replace this with your own repo
    repo: "changesets/changesets",
    commit: changeset.commit,
  });
  let returnVal = `- ${links.commit}${
    links.pull === null ? "" : ` ${links.pull}`
  }${links.user === null ? "" : ` Thanks ${links.user}!`}: ${firstLine}`;
  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  }
  return returnVal;
};

// ...
```

You'll need to [get a GitHub personal access token](https://github.com/settings/tokens/new) with `read:user` and `repo:status` permissions, and add it to a `.env` file.

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

## API

```ts
type Info = {
  user: string | null;
  pull: number | null;
  links: {
    commit: string;
    pull: string | null;
    user: string | null;
  };
};

type Options = {
  commit: string;
  repo: string;
};

export function getInfo(options: Options): Info {
  // magic...
}
```
