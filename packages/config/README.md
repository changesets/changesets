# @changesets/config

> Utilities for reading and parsing Changeset's config

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/config?name=true)](https://npmx.dev/package/@changesets/config)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

```tsx
import { parse, read } from "@changesets/config";

const { config, errors, warnings } = await read(process.cwd(), workspaces);

const { config, errors, warnings } = parse({ commit: true }, workspaces);

if (config == null) {
  console.error(errors.join("\n"))
}
```
