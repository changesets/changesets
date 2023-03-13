# Get Dependents Graph

[![View changelog](https://img.shields.io/badge/changelogs.xyz-Explore%20Changelog-brightgreen)](https://changelogs.xyz/@changesets/get-dependents-graph)

Small helper utility extracted from bolt to get a graph of relationships between packages.

```ts
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { getPackages } from "@manypkg/get-packages";

let { graph, valid } = getDependentsGraph(
  await getPackages(cwd),
  { bumpVersionsWithWorkspaceProtocolOnly: false }
);
```

If the optional second argument contains a `bumpVersionsWithWorkspaceProtocolOnly` value of `true` then the returned graph won't contain dependents whose range starts with `workspace:`. This is useful for people who want to co-locate libraries in a single repo while still having the versioning function as if the packages were hosted in their own repos.

In other words, the following `package.json` would only include `foo`, not `bar`, in its dependency graph. (And thus, during operations like `changeset add` and `changeset version`, only "bump" `bar`'s version in tandem with `foo`.)

``` json
{
  "name": "foo",
  "version": "1.0.0",
  "workspaces": [
    "packages/*",       // Imagine both `bar` and `baz` are packages in this monorepo.
  ]
  "dependencies": {
    "bar": "workspace:^1.0.0",
    "baz": "^1.0.0",
  },
}

```

Mostly published for use in [changesets](https://www.npmjs.com/package/@changesets/cli)
