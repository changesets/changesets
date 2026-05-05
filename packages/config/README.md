# @changesets/config

> Utilities for reading and parsing Changeset's config

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/config?name=true)](https://npmx.dev/package/@changesets/config)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

```tsx
import { parse, read, ValidationError } from "@changesets/config";

let config = await read(process.cwd(), workspaces);

let config = parse({ commit: true }, workspaces);

try {
  return parse({ commit: true }, workspaces);
} catch (err) {
  if (err instanceof ValidationError) {
    let message = err.message;
  } else {
    throw err;
  }
}
```
