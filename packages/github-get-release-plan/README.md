# @changesets/github-get-release-plan

> Get a release plan for a GitHub repo at a specific ref directly from GitHub's API

## Usage

```tsx
```

### Options

#### client

The client should be an authenticated octokit client from `@octokit/rest` that has permissions to the repo you want to get the release plan from.

#### owner

This should be the owner of the repository that you want to get the release plan for.

#### repo

This should be the repository that you wan to get the release plan for.

#### ref

This should be the ref of the repository that you want to get the release plan for. For example, a branch or commit SHA.

#### cache

This is an arbitrary object which stores data used when calculating the git repo that was fetched from GitHub's API, it's strongly advised that you . If the shape of it ever changes, a breaking change of this package will happen and you should make sure not to pass the newer version. It's very important to note that this cache is **REPO SPECIFIC**

## Types

```ts
import { ReleasePlan, Cache } from "@changesets/types";
import Octokit from "@octokit/rest";

type Opts = {
  client: Octokit;
  owner: string;
  repo: string;
  ref: string;
  cache?: Cache;
};

export default function getReleasePlanFromGitHub(
  opts: Opts
): { cache: Cache; releasePlan: ReleasePlan } {}
```
