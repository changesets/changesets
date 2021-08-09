# @changesets/config

> Utilities for reading and parsing Changeset's config

[![View changelog](https://img.shields.io/badge/changelogs.xyz-Explore%20Changelog-brightgreen)](https://changelogs.xyz/@changesets/config)

## Available options

See [the list of available options](https://github.com/atlassian/changesets/blob/main/docs/config-file-options.md) for details about the return value from parsing the config.

## Usage

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
