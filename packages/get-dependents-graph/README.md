# Get Dependents Graph

Small helper utility extracted from bolt to get a graph of relationships between packages.

```ts
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { getPackages } from "@manypkg/get-packages";

let { graph, valid } = getDependentsGraph(await getPackages(cwd));
```

Mostly published for use in [changesets](https://www.npmjs.com/package/@changesets/cli)
