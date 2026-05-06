# @changesets/read

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/read?name=true)](https://npmx.dev/package/@changesets/read)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Read in all changesets from a repository.

```js
import { readChangesets } from "@changesets/read";

let changesets = await readChangesets(cwd);
```

This returns an array of formatted changesets.
