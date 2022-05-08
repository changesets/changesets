# Get Dependents Graph

[![View changelog](https://img.shields.io/badge/changelogs.xyz-Explore%20Changelog-brightgreen)](https://changelogs.xyz/@changesets/get-dependents-graph)

Small helper utility extracted from bolt to get a graph of relationships between packages.

```ts
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { getWorkspaces } from "@changesets/get-workspaces";

let { graph, valid } = getDependentsGraph(await getWorkspaces(cwd));
```

Mostly published for use in [changesets](https://www.npmjs.com/package/@changesets/cli)
