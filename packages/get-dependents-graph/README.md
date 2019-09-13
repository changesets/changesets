# Get Dependents Graph

Small helper utility extracted from bolt to get a graph of relationships between packages.

```ts
import getDependentsGraph from "get-dependents-graph";

await getDependentsGraph({ cwd });
```

Mostly published for use in [changesets](https://www.npmjs.com/package/@changesets/cli)
