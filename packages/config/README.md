# @changesets/config

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/config?name=true)](https://npmx.dev/package/@changesets/config)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Utilities for reading and parsing the Changesets config (i.e. `.changeset/config.json`).

## Usage

```ts
import { readConfig } from "@changesets/config";

const { config, warnings, errors } = await readConfig(process.cwd());

if (warnings.length !== 0) {
  console.warn(warnings);
}
if (config == null) {
  console.error(errors);
  return;
}

console.log(config);
```
