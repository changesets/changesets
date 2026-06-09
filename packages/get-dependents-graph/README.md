# Get Dependents Graph

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/get-dependents-graph?name=true)](https://npmx.dev/package/@changesets/get-dependents-graph)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Small helper utility extracted from bolt to get a graph of relationships between packages.

```ts
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { getPackages } from "@manypkg/get-packages";

const packages = await getPackages(cwd);

let { graph, valid } = getDependentsGraph(packages);
```

Mostly published for use in [changesets](https://npmx.dev/@changesets/cli)
