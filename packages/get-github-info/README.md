# @changesets/get-github-info

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

Then you can use it in your `.changeset/config.js` like this

```jsx
require("dotenv").config();
const { getInfo } = require("@changesets/get-github-info");
```

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
