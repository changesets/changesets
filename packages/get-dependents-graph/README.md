# Get Dependents Graph

[![npm package](https://img.shields.io/npm/v/@changesets/get-dependents-graph)](https://npmjs.com/package/@changesets/get-dependents-graph)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

Small helper utility extracted from bolt to get a graph of relationships between packages.

```ts
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { getPackages } from "@manypkg/get-packages";

const packages = await getPackages(cwd);

let { graph, valid } = getDependentsGraph(packages);
```

Mostly published for use in [changesets](https://www.npmjs.com/package/@changesets/cli)
